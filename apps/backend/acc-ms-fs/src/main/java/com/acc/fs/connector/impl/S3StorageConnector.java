package com.acc.fs.connector.impl;

import java.io.*;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import com.acc.fs.config.S3StorageProperties;
import com.acc.fs.connector.StorageException;
import com.acc.fs.model.FileAttributes;
import com.acc.fs.model.FileConnector;
import com.acc.fs.connector.StorageConnector;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Service
@ConditionalOnBean(S3StorageProperties.class)
public class S3StorageConnector extends BaseStorageConnector implements StorageConnector {

  S3StorageProperties properties;
  S3Client s3Client;
  S3Presigner presigner;

  @Autowired
  public S3StorageConnector(S3StorageProperties properties) {
    this.properties = properties;
    init();
  }

  public void init() {
    this.s3Client = S3Client.builder()
                            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(properties.getKey(), properties.getSecret())))
                            .region(Region.of(properties.getRegion()))
                            .endpointOverride(URI.create(properties.getUrl()))
                            .serviceConfiguration(S3Configuration.builder().checksumValidationEnabled(false).build())
                            .build();
    this.presigner = S3Presigner.builder()
                                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(properties.getKey(), properties.getSecret())))
                                .region(Region.of(properties.getRegion()))
                                .endpointOverride(URI.create(properties.getUrl()))
                                .serviceConfiguration(S3Configuration.builder().checksumValidationEnabled(false).build())
                                .build();;
  }

  @Override
  public FileAttributes store(InputStream inputStream, long length, String code) {
    String bucket = this.properties.getDefaultBucket();
    PutObjectResponse response = this.s3Client.putObject(PutObjectRequest.builder()
                                            .bucket(bucket)
                                            .key(code)
                                            .build()
                            , RequestBody.fromInputStream(inputStream, length));

    return FileAttributes.builder()
                          .s3meta(response.responseMetadata())
                          .bucket(bucket)
                          .code(code)
                          .s3endpoint(properties.getUrl())
                          .s3region(properties.getRegion())
                          .size(length)
                          .build();
  }


  public FileAttributes storeMultipart(InputStream inputStream, String code) {
    String bucket = this.properties.getDefaultBucket();
    CompleteMultipartUploadResponse response = null;
    int partMaxSize = 5*1024*1024;
    long uploadedSize = 0;
    try {
      CreateMultipartUploadRequest createMultipartUploadRequest = CreateMultipartUploadRequest.builder()
                                                                      .bucket(bucket)
                                                                      .key(code)
                                                                      .build();
      // First create a multipart upload and get upload id
      CreateMultipartUploadResponse createMultipartResponse = s3Client.createMultipartUpload(createMultipartUploadRequest);
      String uploadId = createMultipartResponse.uploadId();
      byte[] bytes = new byte[partMaxSize];
      int result = 0;
      int partNumber=0;
      int offset = 0;
      List<CompletedPart> completedParts = new ArrayList<>();
      while(result > -1) {
        result = inputStream.read(bytes, offset, partMaxSize-offset);
        if(result == -1 || offset == partMaxSize) {
          // Upload all the different parts of the object
          UploadPartRequest uploadPartRequest = UploadPartRequest.builder()
            .bucket(bucket)
            .key(code)
            .uploadId(uploadId)
            .partNumber(++partNumber)
            .build();
          UploadPartResponse uploadPartResponse = s3Client.uploadPart(
            uploadPartRequest
            , RequestBody.fromByteBuffer(ByteBuffer.wrap(bytes, 0, offset))
          );
          completedParts.add(
            CompletedPart.builder()
              .partNumber(partNumber)
              .eTag(uploadPartResponse.eTag())
              .build()
          );
          uploadedSize+=offset;
          offset = 0;
        } else {
          offset = offset + result;
        }
      }
      // Finally call completeMultipartUpload operation to tell S3 to merge all uploaded
      // parts and finish the multipart operation.
      CompletedMultipartUpload completedMultipartUpload = CompletedMultipartUpload.builder().parts(completedParts).build();
      CompleteMultipartUploadRequest completeMultipartUploadRequest = CompleteMultipartUploadRequest.builder()
                                                                                  .bucket(bucket)
                                                                                  .key(code)
                                                                                  .uploadId(uploadId)
                                                                                  .multipartUpload(completedMultipartUpload)
                                                                                  .build();
      response = s3Client.completeMultipartUpload(completeMultipartUploadRequest);
    } catch (SdkException | IOException e) {
      throw new StorageException("Failed to upload file to S3", e);
    }
    return FileAttributes.builder()
                        .s3meta(response.responseMetadata())
                        .bucket(bucket)
                        .code(code)
                        .s3endpoint(properties.getUrl())
                        .s3region(properties.getRegion())
                        .size(uploadedSize)
                        .build();
  }

  @Override
  public Stream<Path> list(String prefix) {
    return null;
  }

  @Override
  public Resource loadAsResource(FileAttributes attributes) {
    // Create a GetObjectRequest to be pre-signed
    GetObjectRequest getObjectRequest = GetObjectRequest.builder()
      .bucket(attributes.getBucket())
      .key(attributes.getCode())
      .build();
    this.s3Client.getObject(getObjectRequest);
    return new InputStreamResource(this.s3Client.getObject(getObjectRequest));
  }

//  @Override
//  public Resource loadAsResource(FileAttributes attributes) {
//    // Create a GetObjectRequest to be pre-signed
//    GetObjectRequest getObjectRequest = GetObjectRequest.builder()
//                                                  .bucket(attributes.getBucket())
//                                                  .key(attributes.getCode())
//                                                  .build();
//
//    // Create a GetObjectPresignRequest to specify the signature duration
//    GetObjectPresignRequest getObjectPresignRequest = GetObjectPresignRequest.builder()
//        .signatureDuration(Duration.ofMinutes(10))
//        .getObjectRequest(getObjectRequest)
//        .build();
//
//    PresignedGetObjectRequest presignedGetObjectRequest = presigner.presignGetObject(getObjectPresignRequest);
//    logger.info("Generated presigned URL: " + presignedGetObjectRequest.url());
//    return new UrlResource(presignedGetObjectRequest.url());
//  }

  @Override
  public void deleteAll() {

  }

  @Override
  public FileConnector getConnector() {
    return FileConnector.S3;
  }

  @Override
  public void remove(FileAttributes attributes) {
    DeleteObjectRequest getObjectRequest = DeleteObjectRequest.builder()
                                                              .bucket(attributes.getBucket())
                                                              .key(attributes.getCode())
                                                              .build();
    DeleteObjectResponse  response = this.s3Client.deleteObject(getObjectRequest);
    if(response == null || !response.deleteMarker()) {
      throw new StorageException(String.format("Failed to delete object bucket=%s key=%s", attributes.getBucket(), attributes.getCode()));
    }
  }

  @Override
  public FileAttributes copy(FileAttributes attributes) {
    return null;
  }
}

package com.acc.fs.config;

import java.io.IOException;
import java.util.function.Consumer;

import jakarta.servlet.http.HttpServletRequest;

import com.acc.core.exception.ErrorCodes;
import io.reactivex.rxjava3.core.BackpressureStrategy;
import io.reactivex.rxjava3.core.Flowable;
import org.apache.commons.fileupload2.core.FileItemInput;
import org.apache.commons.fileupload2.core.FileItemInputIterator;
import org.apache.commons.fileupload2.jakarta.servlet6.JakartaServletFileUpload;

import com.acc.core.exception.BusinessException;
import org.springframework.stereotype.Component;

/**
 * File upload helper
 */
@Component
public class MultipartHelper {

  /**
   * Parse request parts can consume them by a callback
   *
   * @param request          the request
   * @param fileItemConsumer the file item consumer
   */
  public void parseRequest(HttpServletRequest request, Consumer<FileItemInput> fileItemConsumer) {
    boolean isMultipart = JakartaServletFileUpload.isMultipartContent(request);
    if (isMultipart) {
      JakartaServletFileUpload upload = new JakartaServletFileUpload();
      FileItemInputIterator iterator = null;
      try {
        iterator = upload.getItemIterator(request);
        while (iterator.hasNext()) {
          FileItemInput fileItem = iterator.next();
          if (fileItemConsumer != null) {
            fileItemConsumer.accept(fileItem);
          }
        }
      } catch (IOException ex) {
        BusinessException.create()
                        .add(ErrorCodes.FAIL_CANNOT_PARSE_MULTIPART)
                        .throwEx(ex);
      }
    } else {
      throw BusinessException.create(false)
                             .add(ErrorCodes.FAIL_MULTIPART_REQUIRED);
    }
  }

  /**
   * Return flowable for request parts
   *
   * @param request the request
   * @return the flowable
   */
  public Flowable<FileItemInput> flowable(HttpServletRequest request) {
    return Flowable.defer(() -> {
      boolean isMultipart = JakartaServletFileUpload.isMultipartContent(request);
      if (isMultipart) {
        JakartaServletFileUpload upload = new JakartaServletFileUpload();
        try {
          final FileItemInputIterator iterator = upload.getItemIterator(request);
          return Flowable.create(emitter -> {
            while (iterator.hasNext()) {
              emitter.onNext(iterator.next());
            }
            emitter.onComplete();
          }, BackpressureStrategy.MISSING);
        } catch (IOException ex) {
          BusinessException.create()
            .add(ErrorCodes.FAIL_CANNOT_PARSE_MULTIPART)
            .throwEx(ex);
        }
      }
      return Flowable.empty();
    });
  }
}

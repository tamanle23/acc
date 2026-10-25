package com.acc.fs.connector.impl;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.stream.Stream;

import com.acc.fs.model.FileAttributes;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;
import org.springframework.web.multipart.MultipartFile;

import com.acc.fs.model.FileConnector;
import com.acc.fs.connector.StorageException;
import com.acc.fs.connector.StorageFileNotFoundException;
import com.acc.fs.config.FileSystemStorageProperties;
import com.acc.fs.connector.StorageConnector;
import com.acc.core.helper.DataTypeHelper;


@Service
public class FileSystemStorageConnector extends BaseStorageConnector implements StorageConnector, InitializingBean {

  private Path rootLocation;

  @Autowired
  FileSystemStorageProperties properties;

  public void init() {
    try {
      if (!rootLocation.toFile().exists()) {
        Files.createDirectory(rootLocation);
      }
    } catch (IOException e) {
      throw new StorageException("Could not initialize storage", e);
    }
  }

  @Override
  public void afterPropertiesSet() throws Exception {
    this.rootLocation = Paths.get(properties.getLocation());
    this.init();
  }

  public void store(MultipartFile file) {
    try {
      if (file.isEmpty()) {
        throw new StorageException("Failed to store empty file " + file.getOriginalFilename());
      }
      Files.copy(file.getInputStream(), this.rootLocation.resolve(file.getOriginalFilename()));
    } catch (IOException e) {
      throw new StorageException("Failed to store file " + file.getOriginalFilename(), e);
    }
  }

  @Override
  public Stream<Path> list(String prefix) {
    try {
      return Files.walk(this.rootLocation, 1)
                  .filter(path -> !path.equals(rootLocation))
                  .map(path -> rootLocation.relativize(path));
    } catch (IOException e) {
      throw new StorageException("Failed to read stored files", e);
    }
  }

  protected Path load(String filename) {
    return rootLocation.resolve(filename);
  }

  @Override
  public Resource loadAsResource(FileAttributes attributes) {
    String code = attributes.getCode();
    try {
      Path file = load(code);
      Resource resource = new UrlResource(file.toUri());
      if (resource.exists() || resource.isReadable()) {
        return resource;
      } else {
        throw new StorageFileNotFoundException("Could not read file: " + code);
      }
    } catch (MalformedURLException e) {
      throw new StorageFileNotFoundException("Could not read file: " + code, e);
    }
  }

  @Override
  public void deleteAll() {
    FileSystemUtils.deleteRecursively(rootLocation.toFile());
  }

  public void store(MultipartFile[] files) {
    if(files !=null){
      for(MultipartFile file:files) {
        this.store(file);
      }
    }
  }

  @Override
  public FileAttributes store(InputStream inputStream, long length, String code) {
    Path path;
    try {
      path = this.rootLocation.resolve(code);
      Files.copy(inputStream, path, StandardCopyOption.REPLACE_EXISTING);
    } catch (IOException e) {
      throw new StorageException("Failed to store file " + code, e);
    }
    return FileAttributes.builder()
                        .code(code)
                        .rootLocation(this.rootLocation.toString())
                        .cluster(this.properties.getCluster())
                        .contentType( DataTypeHelper.getFileContentType(path))
                        .size(this.getFileSize(path))
                        .build();
  }

  private long getFileSize(Path path) {
    try {
      return Files.size(path);
    } catch (IOException e) {
      return -1;
    }
  }

  @Override
  public FileConnector getConnector() {
    return FileConnector.DEFAULT_CONNECTOR;
  }

  @Override
  public void remove(FileAttributes attributes) {
    try {
      Files.deleteIfExists(this.rootLocation.resolve(attributes.getCode()));
    } catch (IOException e) {
      throw new StorageException("Failed to remove file  " + attributes.getCode(), e);
    }
  }

  @Override
  public FileAttributes copy(FileAttributes attributes) {
    String name = this.acquireIdentifier();
    try {
      Files.copy(this.rootLocation.resolve(attributes.getCode()),  this.rootLocation.resolve(name));
    } catch (IOException e) {
      throw new StorageException("Failed to copy file " + attributes.getCode(), e);
    }
    attributes.setCode(name);
    return attributes;
  }


}

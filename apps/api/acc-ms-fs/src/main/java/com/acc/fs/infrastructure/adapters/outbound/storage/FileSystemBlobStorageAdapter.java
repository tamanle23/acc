package com.acc.fs.infrastructure.adapters.outbound.storage;

import com.acc.fs.config.FileSystemStorageProperties;
import com.acc.fs.connector.StorageException;
import com.acc.fs.domain.repository.BlobStoragePort;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

@Component
public class FileSystemBlobStorageAdapter implements BlobStoragePort {

    private final Path rootLocation;

    public FileSystemBlobStorageAdapter(FileSystemStorageProperties properties) {
        this.rootLocation = Paths.get(properties.getLocation()).toAbsolutePath().normalize();
        try {
            if (!Files.exists(this.rootLocation)) {
                Files.createDirectories(this.rootLocation);
            }
        } catch (IOException e) {
            throw new StorageException("Could not initialize storage directory: " + this.rootLocation, e);
        }
    }

    @Override
    public String store(InputStream inputStream, long sizeBytes, String storagePath) {
        try {
            Path target = this.rootLocation.resolve(storagePath).normalize();
            if (!target.startsWith(this.rootLocation)) {
                throw new StorageException("Cannot store file outside current directory: " + storagePath);
            }
            if (target.getParent() != null && !Files.exists(target.getParent())) {
                Files.createDirectories(target.getParent());
            }
            Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
            return storagePath;
        } catch (IOException e) {
            throw new StorageException("Failed to store stream to " + storagePath, e);
        }
    }

    @Override
    public InputStream loadAsStream(String storagePath) {
        try {
            Path file = this.rootLocation.resolve(storagePath).normalize();
            if (!file.startsWith(this.rootLocation) || !Files.exists(file)) {
                throw new StorageException("File not found: " + storagePath);
            }
            return Files.newInputStream(file);
        } catch (IOException e) {
            throw new StorageException("Failed to read file: " + storagePath, e);
        }
    }

    @Override
    public boolean delete(String storagePath) {
        try {
            Path file = this.rootLocation.resolve(storagePath).normalize();
            if (!file.startsWith(this.rootLocation)) {
                return false;
            }
            return Files.deleteIfExists(file);
        } catch (IOException e) {
            return false;
        }
    }

    @Override
    public boolean exists(String storagePath) {
        Path file = this.rootLocation.resolve(storagePath).normalize();
        return file.startsWith(this.rootLocation) && Files.exists(file);
    }
}

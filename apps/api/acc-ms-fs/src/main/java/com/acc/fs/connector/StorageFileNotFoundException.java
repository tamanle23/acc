package com.acc.fs.connector;

public class StorageFileNotFoundException extends StorageException {

	private static final long serialVersionUID = -8001506264572636245L;

	public StorageFileNotFoundException(String message) {
		super(message);
	}

	public StorageFileNotFoundException(String message, Throwable cause) {
		super(message, cause);
	}
}

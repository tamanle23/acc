package com.acc.fs.connector;

public class StorageException extends RuntimeException {

	private static final long serialVersionUID = -972233285832422135L;

	public StorageException(String message) {
		super(message);
	}

	public StorageException(String message, Throwable cause) {
		super(message, cause);
	}
}

package com.bleled.com;

/** An update failure with a stable machine-readable code that the web layer turns into a plain-English message. */
final class UpdateException extends Exception {
    private static final long serialVersionUID = 1L;

    static final String BAD_ARGS = "BAD_ARGS";
    static final String BAD_URL = "BAD_URL";
    static final String NETWORK = "NETWORK";
    static final String NETWORK_TIMEOUT = "NETWORK_TIMEOUT";
    static final String HTTP_ERROR = "HTTP_ERROR";
    static final String SIZE_MISMATCH = "SIZE_MISMATCH";
    static final String TOO_LARGE = "TOO_LARGE";
    static final String NO_SPACE = "NO_SPACE";
    static final String STORAGE_ERROR = "STORAGE_ERROR";
    static final String CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH";
    static final String CANCELLED = "CANCELLED";
    static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    static final String INSTALL_PERMISSION = "INSTALL_PERMISSION";
    static final String NOT_READY = "NOT_READY";
    static final String INSTALL_FAILED = "INSTALL_FAILED";
    static final String BUSY = "BUSY";

    final String code;

    UpdateException(String code, String message) {
        super(message);
        this.code = code;
    }

    UpdateException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }
}

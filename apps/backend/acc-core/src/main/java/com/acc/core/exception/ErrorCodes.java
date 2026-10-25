package com.acc.core.exception;

import com.acc.core.io.Error;
import com.acc.core.io.validation.ViolationDetail;

public enum ErrorCodes {

    NONE("No error code available."),

    ERROR("General system error."),
    ERROR_NOT_EXISTED("Entity doesn't exist."),
    ERROR_NOT_CONSISTENT("Object's state isn't consistent. Try to fetch new one and make another submission."),
    ERROR_NOT_DELETABLE("Delete is not allowed."),
    ERROR_CODE_ALREADY_EXISTED("Code already existed."),
    ERROR_ACCESS_DENIED("User doesn't have sufficient permissions."),
    ERROR_USER_DISABLED("User's disabled."),
    ERROR_LOGIN_INVALID_CREDENTIALS("Invalid credentials."),
    ERROR_SCHEDULER_JOBNAME_EXISTS("Job name already exists."),
    ERROR_SCHEDULER_JOBNAME_NOT_EXISTS("Job name doesn't exists."),
    ERROR_SCHEDULER_DELETE_JOB_RUNNING("Cannot delete running job."),
    ERROR_SCHEDULER_PAUSE_JOB_NOT_RUNNING("Cannot pause stopped job."),
    ERROR_SCHEDULER_RESUME_JOB_NOT_PAUSED("Cannot resume unpaused job."),
    ERROR_SCHEDULER_STOP_JOB_NOT_RUNNING("Cannot stop not running job."),
    ERROR_SCHEDULER_START_JOB_RUNNING("Cannot start running job."),
    ERROR_TARGET_FILE_NOT_FOUND("Target folder not found."),
    ERROR_JOB_CANNOT_BE_STOPPED("Job cannot be stopped"),
    ERROR_JOB_CANNOT_BE_STARTED("Job cannot be started"),
    ERROR_JOB_CANNOT_BE_RESTARTED("Job cannot be restarted"),
    ERROR_JOB_DOESNT_EXIST("Job doesn't exist"),
    ERROR_FILE_PERSIST_FAILED("File cannot be persisted."),
    ERROR_MAX_BULK_REACHED("Max bulk size's reached."),

    FAIL_ENDPOINT_MAPPING("Request mapping failed."),
    FAIL_VALIDATION("Validation failed."),
    FAIL_MULTIPART_REQUIRED("Request must be in multipart form."),
    FAIL_CANNOT_PARSE_MULTIPART("FAIL to parse multipart files."),
    FAIL_PARENT_FILE_NOT_DIRECTORY("Parent must be a directory."),
    FAIL_PARENT_NOT_EXIST("Parent doesn't exist.")

    ;

    private String message;
    private ErrorCodes(String message){
        this.message = message;
    }
    public String getMessage(){
        return this.message;
    }
}

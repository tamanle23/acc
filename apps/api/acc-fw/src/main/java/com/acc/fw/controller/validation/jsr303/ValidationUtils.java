package com.acc.fw.controller.validation.jsr303;

import java.util.List;
import java.util.stream.Collectors;

import com.acc.core.exception.ErrorCodes;
import com.acc.core.io.Error;

import org.springframework.validation.ObjectError;

public class ValidationUtils {

  public static Error[] map(List<ObjectError> allErrors) {
    return allErrors.parallelStream()
                    .map(n->{
                        Error error = new Error();
                        if(n.getArguments().length>1){
                            if(n.getArguments()[0].getClass().equals(ErrorCodes.class)){
                                error.setCode(((ErrorCodes)n.getArguments()[0]).toString());
                            }
                            if(n.getArguments()[1].getClass().equals(String.class)){
                                error.setMessage((String)n.getArguments()[1]);
                            }
                            return error;
                        }
                        return null;
                    })
                    .collect(Collectors.toList())
                    .toArray(new Error[0]);
  }

}


package com.acc.core.io;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.acc.core.exception.ErrorCodes;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Error<T> {
    private String code;
    private String message;
    @JsonUnwrapped
    private T detail;

    @Builder
    public Error(ErrorCodes errorCodes, String code, String message, T detail) {
      if(errorCodes != null) {
        this.code = errorCodes.name();
        this.message = errorCodes.getMessage();
      } else {
        this.code = code;
        this.message = message;
      }
      this.detail = detail;
    }
}

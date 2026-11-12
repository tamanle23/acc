package com.acc.identity.application.user.port.in;

import com.acc.identity.application.user.command.RegisterUserCommand;
import com.acc.identity.domain.user.valobj.UserId;

/**
 * Primary Driving Port for User Registration.
 */
public interface RegisterUserUseCase {

    UserId registerUser(RegisterUserCommand command);
}

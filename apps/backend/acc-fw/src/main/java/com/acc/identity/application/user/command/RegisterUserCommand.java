package com.acc.identity.application.user.command;

import com.acc.core.mediator.Command;
import com.acc.identity.domain.user.valobj.UserId;

public record RegisterUserCommand(
    String tenantId,
    String username,
    String email,
    String rawPassword
) implements Command<UserId> {
}

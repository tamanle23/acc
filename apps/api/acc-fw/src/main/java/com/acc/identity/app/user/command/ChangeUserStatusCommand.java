package com.acc.identity.app.user.command;

import com.acc.core.mediator.Command;
import com.acc.user.model.enums.UserStatus;

public record ChangeUserStatusCommand(String userName, UserStatus status) implements Command<Void> {}

package com.unipost.identity.app.user.command;

import com.unipost.core.mediator.Command;
import com.unipost.user.model.enums.UserStatus;

public record ChangeUserStatusCommand(String userName, UserStatus status) implements Command<Void> {}

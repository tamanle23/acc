package com.acc.identity.app.user.command;

import com.acc.core.mediator.Command;

public record RegisterUserCommand(String userName, String email, String password) implements Command<Long> {}

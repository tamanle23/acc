package com.unipost.identity.app.user.command;

import com.unipost.core.mediator.Command;

public record RegisterUserCommand(String userName, String email, String password) implements Command<Long> {}

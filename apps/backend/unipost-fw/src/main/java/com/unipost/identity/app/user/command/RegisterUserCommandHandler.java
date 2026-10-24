package com.unipost.identity.app.user.command;

import com.unipost.core.domain.UserRegisteredEvent;
import com.unipost.core.mediator.CommandHandler;
import com.unipost.identity.domain.user.repository.UserRepository;
import com.unipost.user.model.User;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RegisterUserCommandHandler implements CommandHandler<RegisterUserCommand, Long> {

    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    public RegisterUserCommandHandler(UserRepository userRepository, ApplicationEventPublisher eventPublisher) {
        this.userRepository = userRepository;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public Long handle(RegisterUserCommand command) {
        if (userRepository.existsByUserName(command.userName())) {
            throw new IllegalArgumentException("Username already taken.");
        }

        User user = new User();
        user.setUserName(command.userName());
        user.setEmail(command.email());
        user.setPassword(command.password());

        user = userRepository.save(user);

        // Publish event to the Modulith Event Bus
        eventPublisher.publishEvent(new UserRegisteredEvent(user.getId(), user.getUserName(), user.getEmail()));

        return user.getId();
    }
}

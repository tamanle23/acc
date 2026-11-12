package com.acc.identity.app.user.query;

import com.acc.core.mediator.QueryHandler;
import com.acc.identity.domain.user.repository.UserRepository;
import com.acc.user.controller.response.UserResponseModel;
import com.acc.user.model.User;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class GetUserByUserNameQueryHandler implements QueryHandler<GetUserByUserNameQuery, UserResponseModel> {

    private final UserRepository userRepository;

    public GetUserByUserNameQueryHandler(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserResponseModel handle(GetUserByUserNameQuery query) {
        Optional<User> userOpt = userRepository.findByUserName(query.userName());
        if (userOpt.isEmpty()) {
            throw new IllegalArgumentException("User not found");
        }

        User user = userOpt.get();
        UserResponseModel model = new UserResponseModel();
        model.setUserName(user.getUserName());
        model.setEmail(user.getEmail());
        model.setFirstName(user.getFirstName());
        model.setLastName(user.getLastName());
        return model;
    }
}

package com.unipost.identity.web.user.controller;

import com.unipost.core.mediator.CommandDispatcher;
import com.unipost.core.mediator.QueryDispatcher;
import com.unipost.identity.app.user.command.RegisterUserCommand;
import com.unipost.identity.app.user.command.ChangeUserStatusCommand;
import com.unipost.identity.app.user.query.GetUserByUserNameQuery;
import com.unipost.user.controller.response.UserResponseModel;
import com.unipost.user.model.enums.UserStatus;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/users")
public class UserCQRSController {

    private final CommandDispatcher commandDispatcher;
    private final QueryDispatcher queryDispatcher;

    public UserCQRSController(CommandDispatcher commandDispatcher, QueryDispatcher queryDispatcher) {
        this.commandDispatcher = commandDispatcher;
        this.queryDispatcher = queryDispatcher;
    }

    @PostMapping("/register")
    public ResponseEntity<Long> registerUser(@RequestBody RegisterUserRequest request) {
        var command = new RegisterUserCommand(request.userName(), request.email(), request.password());
        Long userId = commandDispatcher.dispatch(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(userId);
    }

    @PutMapping("/{userName}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable String userName, @RequestBody ChangeStatusRequest request) {
        var command = new ChangeUserStatusCommand(userName, request.status());
        commandDispatcher.dispatch(command);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userName}")
    public ResponseEntity<UserResponseModel> getUserByUserName(@PathVariable String userName) {
        var query = new GetUserByUserNameQuery(userName);
        UserResponseModel response = queryDispatcher.dispatch(query);
        return ResponseEntity.ok(response);
    }

    public record RegisterUserRequest(String userName, String email, String password) {}
    public record ChangeStatusRequest(UserStatus status) {}
}

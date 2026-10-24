package com.unipost.identity.app.user.query;

import com.unipost.core.mediator.Query;
import com.unipost.user.controller.response.UserResponseModel;

public record GetUserByUserNameQuery(String userName) implements Query<UserResponseModel> {}

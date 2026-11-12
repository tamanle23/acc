package com.acc.identity.app.user.query;

import com.acc.core.mediator.Query;
import com.acc.user.controller.response.UserResponseModel;

public record GetUserByUserNameQuery(String userName) implements Query<UserResponseModel> {}

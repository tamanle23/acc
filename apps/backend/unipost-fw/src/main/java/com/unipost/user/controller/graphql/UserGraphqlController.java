package com.unipost.user.controller.graphql;

import com.unipost.core.constant.PermissionActionConstants;
import com.unipost.core.constant.ResourceConstants;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.Page;
import com.unipost.core.io.RequestWrapper;
import com.unipost.fw.CommonController;
import com.unipost.user.controller.mapping.UserMapper;
import com.unipost.user.controller.request.PermissionVm;
import com.unipost.user.controller.request.RoleVm;
import com.unipost.user.controller.request.UserPermissionSearchCondition;
import com.unipost.user.controller.request.UserRoleSearchCondition;
import com.unipost.user.controller.request.UserSearchCondition;
import com.unipost.user.controller.request.UserVm;
import com.unipost.user.model.User;
import com.unipost.user.model.enums.UserType;
import com.unipost.user.service.UserService;
import com.unipost.user.facade.UserFacade;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

import java.util.List;

/**
 * GraphQL query controller for User operations.
 * Mirrors all read-only operations from {@link com.unipost.user.controller.UserQueryController}
 * and exposes them via Spring for GraphQL ({@code /graphql} endpoint).
 */
@Controller
public class UserGraphqlController extends CommonController {

  @Autowired
  UserService<User> userService;

  @Autowired
  UserMapper userMapper;

  @Autowired
  UserFacade userFacade;

  /**
   * Fetch a single user by their UID.
   *
   * @param uid the user's unique identifier
   * @return the mapped {@link UserVm} or {@code null} if not found
   */
  @QueryMapping
  @PreAuthorize("hasPermission('" + ResourceConstants.USER + "', '" + PermissionActionConstants.LIST + "')")
  public UserVm user(@Argument("uid") String uid) {
    return userMapper.userToResponseModel(userService.findByUid(uid));
  }

  /**
   * Search / list users with optional filtering and pagination.
   *
   * @param request optional search criteria (userName, userTypes, page, size)
   * @return paginated list of {@link UserVm}
   */
  @QueryMapping
  @PreAuthorize("hasPermission('" + ResourceConstants.USER + "', '" + PermissionActionConstants.LIST + "')")
  public Page<UserVm> users(@Argument("request") UserSearchInput request) {
    UserSearchCondition condition = toSearchCondition(request);
    RequestWrapper<ContextHeader, UserSearchCondition> wrapped = extractRequest(condition);
    return userMapper.pageToResponsePage(userService.findBy(wrapped));
  }

  /**
   * Fetch a user's directly-assigned permissions (paginated).
   *
   * @param uid     the user's unique identifier
   * @param request optional pagination input
   * @return paginated list of {@link PermissionVm}
   */
  @QueryMapping
  @PreAuthorize("hasPermission('" + ResourceConstants.USER + "', '" + PermissionActionConstants.LIST + "')")
  public Page<PermissionVm> userPermissions(@Argument("uid") String uid, @Argument("request") PageInput request) {
    UserPermissionSearchCondition condition = new UserPermissionSearchCondition();
    applyPagination(condition, request);
    return userService.findUserPermissions(uid, extractRequest(condition));
  }

  /**
   * Fetch a user's assigned roles (paginated).
   *
   * @param uid     the user's unique identifier
   * @param request optional pagination input
   * @return paginated list of {@link RoleVm}
   */
  @QueryMapping
  @PreAuthorize("hasPermission('" + ResourceConstants.USER + "', '" + PermissionActionConstants.LIST + "')")
  public Page<RoleVm> userRoles(@Argument("uid") String uid, @Argument("request") PageInput request) {
    UserRoleSearchCondition condition = new UserRoleSearchCondition();
    applyPagination(condition, request);
    return userService.findUserRoles(uid, extractRequest(condition));
  }

  /**
   * Fetch a user together with their fully-expanded permissions.
   *
   * @param uid the user's unique identifier
   * @return the {@link UserVm} with {@code userPermissions} populated
   */
  @QueryMapping
  @PreAuthorize("hasPermission('" + ResourceConstants.USER + "', '" + PermissionActionConstants.LIST + "')")
  public UserVm userWithPermissions(@Argument("uid") String uid) {
    return userFacade.findUserWithPermissions(uid);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Map a GraphQL {@link UserSearchInput} argument to the service-layer
   * {@link UserSearchCondition}. Returns an empty condition when the argument
   * is {@code null} (i.e. the caller omitted the {@code request} input entirely).
   */
  private UserSearchCondition toSearchCondition(UserSearchInput request) {
    UserSearchCondition condition = new UserSearchCondition();
    if (request == null) {
      return condition;
    }
    condition.setUserName(request.userName());
    if (request.userTypes() != null) {
      condition.setUserTypes(request.userTypes());
    }
    applyPagination(condition, request.page(), request.size());
    return condition;
  }

  /**
   * Apply page / size from a generic {@link PageInput} onto any
   * {@link com.unipost.core.io.SearchCondition}-derived object.
   */
  private void applyPagination(com.unipost.core.io.SearchCondition condition, PageInput input) {
    if (input == null) return;
    applyPagination(condition, input.page(), input.size());
  }

  private void applyPagination(com.unipost.core.io.SearchCondition condition, Integer page, Integer size) {
    if (page == null && size == null) return;
    com.unipost.core.io.PageRequest pageRequest = new com.unipost.core.io.PageRequest();
    if (page != null) pageRequest.setNumber(page);
    if (size != null) pageRequest.setSize(size);
    condition.setPageRequest(pageRequest);
  }

  // ─── GraphQL input record types ─────────────────────────────────────────────

  /**
   * GraphQL input type for user search. Mirrors the fields of
   * {@link UserSearchCondition} that are safe to expose via the API.
   */
  public record UserSearchInput(
      String userName,
      List<UserType> userTypes,
      Integer page,
      Integer size
  ) {}

  /**
   * Generic pagination input for queries that do not need filtering.
   */
  public record PageInput(
      Integer page,
      Integer size
  ) {}
}

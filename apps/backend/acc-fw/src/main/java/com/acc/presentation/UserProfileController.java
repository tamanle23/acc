package com.acc.presentation;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.fw.ResponseEntityBuilder;
import com.acc.service.authentication.UserDetailsImpl;
import com.acc.system.dto.UpdateUserProfileRequest;
import com.acc.system.dto.UserProfileDto;
import com.acc.user.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Self-service user profile controller.
 * Accessible to any authenticated user to retrieve or modify their own personal profile and preferences.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/user/profile")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService profileService;
    private final ResponseEntityBuilder responseBuilder;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ResponseWrapper<ContextHeader, UserProfileDto>> getProfile(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        String username = userDetails != null ? userDetails.getUsername() : "anonymous";
        UserProfileDto profile = profileService.getUserProfile(username);
        return responseBuilder.success(profile);
    }

    @PutMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ResponseWrapper<ContextHeader, UserProfileDto>> updateProfile(
            @Valid @RequestBody UpdateUserProfileRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        String username = userDetails != null ? userDetails.getUsername() : "anonymous";
        UserProfileDto updated = profileService.updateUserProfile(username, request);
        return responseBuilder.success(updated);
    }
}

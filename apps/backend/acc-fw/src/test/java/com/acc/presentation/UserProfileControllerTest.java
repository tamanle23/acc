package com.acc.presentation;

import com.acc.core.context.Context;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.fw.ResponseEntityBuilder;
import com.acc.system.dto.UpdateUserProfileRequest;
import com.acc.system.dto.UserProfileDto;
import com.acc.user.service.UserProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserProfileControllerTest {

    @Mock
    private UserProfileService profileService;

    @Mock
    private Context contextHelper;

    private ResponseEntityBuilder responseBuilder;
    private UserProfileController controller;

    @BeforeEach
    void setUp() {
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        when(contextHelper.getHeader()).thenReturn(new ContextHeader());
        controller = new UserProfileController(profileService, responseBuilder);
    }

    @Test
    void testGetProfileWithStandardAuthentication() {
        UserProfileDto expected = UserProfileDto.builder()
                .userId("1")
                .username("admin")
                .firstName("Platform")
                .lastName("Admin")
                .email("admin@acc.io")
                .phoneNumber("123456789")
                .preferences(Collections.emptyMap())
                .build();
        when(profileService.getUserProfile("admin")).thenReturn(expected);

        Authentication auth = new UsernamePasswordAuthenticationToken(
                "admin", "credential", List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );

        ResponseEntity<ResponseWrapper<ContextHeader, UserProfileDto>> response = controller.getProfile(auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getBody()).isEqualTo(expected);
        verify(profileService).getUserProfile("admin");
    }

    @Test
    void testGetProfileWithUserDetailsPrincipal() {
        UserProfileDto expected = UserProfileDto.builder()
                .userId("2")
                .username("johndoe")
                .firstName("John")
                .lastName("Doe")
                .email("john@acc.io")
                .preferences(Collections.emptyMap())
                .build();
        when(profileService.getUserProfile("johndoe")).thenReturn(expected);

        User principal = new User("johndoe", "pass", Collections.emptyList());
        Authentication auth = new UsernamePasswordAuthenticationToken(principal, "pass", Collections.emptyList());

        ResponseEntity<ResponseWrapper<ContextHeader, UserProfileDto>> response = controller.getProfile(auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getBody().getEmail()).isEqualTo("john@acc.io");
        verify(profileService).getUserProfile("johndoe");
    }

    @Test
    void testUpdateProfile() {
        UpdateUserProfileRequest request = UpdateUserProfileRequest.builder()
                .firstName("Jane")
                .lastName("Doe")
                .email("jane@acc.io")
                .preferences(Collections.emptyMap())
                .build();
        UserProfileDto updated = UserProfileDto.builder()
                .userId("3")
                .username("janedoe")
                .firstName("Jane")
                .lastName("Doe")
                .email("jane@acc.io")
                .preferences(Collections.emptyMap())
                .build();
        when(profileService.updateUserProfile(eq("janedoe"), eq(request))).thenReturn(updated);

        Authentication auth = new UsernamePasswordAuthenticationToken(
                "janedoe", "credential", Collections.emptyList()
        );

        ResponseEntity<ResponseWrapper<ContextHeader, UserProfileDto>> response = controller.updateProfile(request, auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getBody().getFirstName()).isEqualTo("Jane");
        verify(profileService).updateUserProfile("janedoe", request);
    }
}

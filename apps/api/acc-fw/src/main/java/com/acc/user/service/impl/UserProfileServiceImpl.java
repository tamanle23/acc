package com.acc.user.service.impl;

import com.acc.identity.infra.user.repository.jpa.UserRepository;
import com.acc.service.exception.MetadataNotFoundException;
import com.acc.system.dto.UpdateUserProfileRequest;
import com.acc.system.dto.UserProfileDto;
import com.acc.user.model.User;
import com.acc.user.service.UserProfileService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserProfileServiceImpl implements UserProfileService {

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public UserProfileDto getUserProfile(String username) {
        User user = userRepository.findByUserName(username);
        if (user == null) {
            throw new MetadataNotFoundException("User not found: " + username);
        }
        return mapToDto(user);
    }

    @Override
    @Transactional
    public UserProfileDto updateUserProfile(String username, UpdateUserProfileRequest request) {
        User user = userRepository.findByUserName(username);
        if (user == null) {
            throw new MetadataNotFoundException("User not found: " + username);
        }

        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(request.getEmail().trim());
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(request.getPhoneNumber().trim());
        }

        if (request.getPreferences() != null) {
            try {
                user.setPreferences(objectMapper.writeValueAsString(request.getPreferences()));
            } catch (Exception e) {
                log.warn("Failed to serialize user preferences for user {}", username, e);
            }
        }

        User saved = userRepository.save(user);
        return mapToDto(saved);
    }

    private UserProfileDto mapToDto(User user) {
        Map<String, Object> preferences = Collections.emptyMap();
        if (user.getPreferences() != null && !user.getPreferences().isBlank()) {
            try {
                preferences = objectMapper.readValue(user.getPreferences(), new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                log.warn("Failed to deserialize user preferences for user {}", user.getUserName(), e);
                preferences = new HashMap<>();
            }
        }

        return UserProfileDto.builder()
                .userId(user.getUid() != null ? user.getUid() : String.valueOf(user.getId()))
                .username(user.getUserName())
                .firstName(user.getFirstName() != null ? user.getFirstName() : "")
                .lastName(user.getLastName() != null ? user.getLastName() : "")
                .email(user.getEmail() != null ? user.getEmail() : "")
                .phoneNumber(user.getPhoneNumber() != null ? user.getPhoneNumber() : "")
                .preferences(preferences)
                .build();
    }
}

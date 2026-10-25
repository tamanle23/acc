package com.acc.fw.authentication;

import java.io.IOException;

import jakarta.inject.Inject;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import com.acc.service.user.LoginAttemptService;
import org.springframework.security.authentication.LockedException;
import org.springframework.web.filter.OncePerRequestFilter;

public class LoginAttemptFilter extends OncePerRequestFilter {

	private LoginAttemptService loginAttemptService;

	public LoginAttemptFilter(LoginAttemptService loginAttemptService) {
	  this.loginAttemptService = loginAttemptService;
	}
	
	@Override
	protected final void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {
		if (loginAttemptService.isBlocked(getClientIP(request))){
			throw new LockedException("You are blocked!");
		}
		filterChain.doFilter(request, response);
	}

	private String getClientIP(HttpServletRequest request) {
		String xfHeader = request.getHeader("X-Forwarded-For");
		if (xfHeader == null) {
			return request.getRemoteAddr();
		}
		return xfHeader.split(",")[0];
	}

}
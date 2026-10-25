package com.acc.boot.config;

import java.util.List;
import jakarta.inject.Inject;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.acc.boot.config.properties.ApplicationProperties;
import com.acc.fw.core.jwt.JwtAuthenticationTokenFilter;

@Configuration
@EnableMethodSecurity
@Order(90)
public class SecurityConfiguration {

  @Inject
  ApplicationProperties applicationProperties;

  @Inject
  PasswordEncoder passwordEncoder;

  @Value("${application.security.maxSession:1}")
  private int SESSION_MAX;

  @Autowired(required = false)
  UserDetailsService userDetailsService;

  @Autowired
  private Environment environment;

  @Bean
  public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
    return authConfig.getAuthenticationManager();
  }

  @Bean
  @ConditionalOnProperty(prefix = "application.security", value = "tokenUrl")
  public JwtAuthenticationTokenFilter jwtAuthenticationTokenFilter() {
    return new JwtAuthenticationTokenFilter();
  }

  @Bean
  public com.acc.fw.security.PublishableKeyFilter publishableKeyFilter() {
    return new com.acc.fw.security.PublishableKeyFilter();
  }

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    if (!this.environment.acceptsProfiles(Profiles.of("nonsecured"))) {
      http
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
        .httpBasic(hb -> {})
        .logout(logout -> logout.permitAll());

      http.authorizeHttpRequests(authz -> {
        if (applicationProperties.getSecurity() != null && applicationProperties.getSecurity().getPermitAlls() != null) {
          authz.requestMatchers(applicationProperties.getSecurity().getPermitAlls()).permitAll();
        }
        authz.anyRequest().authenticated();
      });
      http.csrf(csrf -> {
        if (applicationProperties.getSecurity() != null && applicationProperties.getSecurity().getPermitAlls() != null) {
          csrf.ignoringRequestMatchers(applicationProperties.getSecurity().getPermitAlls());
        }
      });

      http.addFilterBefore(publishableKeyFilter(), UsernamePasswordAuthenticationFilter.class);

      if (applicationProperties.getSecurity() != null && applicationProperties.getSecurity().getJwtTokenSecret() != null) {
        http.addFilterBefore(jwtAuthenticationTokenFilter(), UsernamePasswordAuthenticationFilter.class);
      }
    } else {
      http.csrf(csrf -> csrf.disable())
          .cors(cors -> cors.configurationSource(corsConfigurationSource()))
          .authorizeHttpRequests(authz -> authz.anyRequest().permitAll());
    }
    return http.build();
  }

  // The Golden Rule: The Wildcard ConflictFor security reasons, web browsers enforce a strict rule when credentials are involved:
  // You cannot use wildcards (*) for allowed origins if credentials are allowed.setAllowCredentials(true)
  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    final CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(List.of("*"));
    configuration.setAllowedMethods(List.of("HEAD", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
    configuration.setAllowCredentials(false); // with AllowedOrigins * and this true cannot bypass cors
    configuration.setAllowedHeaders(List.of("*"));
    configuration.setExposedHeaders(List.of("X-Auth-Token", "Authorization", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"));
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }
}

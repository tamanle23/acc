# Stage 1: Build the Maven Project
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /build
# Copy the backend parent POM and all submodules
COPY apps/backend/ ./

# Build the All-In-One (AIO) wrapper module and all its dependencies
# We use -am (also make) and -pl (project list) to build only what's needed for AIO
RUN mvn clean package -pl acc-ms-aio -am -DskipTests

# Stage 2: Minimal Runtime Environment
FROM eclipse-temurin:17-jre-alpine AS runner

# Add Maintainer Info
LABEL maintainer="Acc Team"

ENV APPLICATION_NAME=acc-ms-aio
ENV APPLICATION_PORT=80
ENV APPLICATION_PROFILE=prod
ENV WORKING_DIRECTORY=/app

EXPOSE ${APPLICATION_PORT}

WORKDIR ${WORKING_DIRECTORY}

# Create a non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy the built JAR from the builder stage
COPY --from=builder /build/acc-ms-aio/target/*.jar ./app.jar

ENTRYPOINT ["java", "-Dspring.profiles.active=${APPLICATION_PROFILE}", "-Dserver.port=${APPLICATION_PORT}", "-jar", "app.jar"]

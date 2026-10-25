# Start with a base image containing Java runtime
FROM openjdk:8-jdk-alpine

# Install timezones data
RUN apk add --no-cache tzdata

# Add Maintainer Info
LABEL maintainer="tamanle23@gmail.com"

#Default arguments and environment variables

ARG APPLICATION_CLUSTER=startx
ENV APPLICATION_NAME=startx-ms-auth-server
ENV APPLICATION_PORT=80
ENV APPLICATION_PROFILE=dev
ENV WORKING_DIRECTORY=/app/${startx}/${APPLICATION_NAME}

## The application's jar fsObject
ARG JAR_FILE=./startx-ms-auth-server-0.0.1.jar
ENV TZ=Asia/Singapore

# Make port 80 available to the world outside this container
EXPOSE ${APPLICATION_PORT}

# Creating working dir structure
RUN mkdir -p "${WORKING_DIRECTORY}" \
    mkdir -p "${WORKING_DIRECTORY}/logs"

WORKDIR "${WORKING_DIRECTORY}"

# Add the application's jar to the container
ADD ${JAR_FILE} "${WORKING_DIRECTORY}/startx-ms-auth-server.jar"

# Run the jar fsObject
ENTRYPOINT pwd && ls -l && \
           java -Dspring.application.name=$APPLICATION_NAME \
                -Dspring.profiles.active=$APPLICATION_PROFILE \
                -Dserver.port=$APPLICATION_PORT \
                -jar  \
                ./startx-ms-auth-server.jar

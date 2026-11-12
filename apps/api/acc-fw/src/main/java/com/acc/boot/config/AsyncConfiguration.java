package com.acc.boot.config;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ConcurrentTaskExecutor;
import org.springframework.scheduling.concurrent.ScheduledExecutorFactoryBean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import com.acc.core.context.Context;
import com.acc.fw.context.AsyncContextTaskDecorator;

@Configuration
@EnableScheduling
@EnableAsync
public class AsyncConfiguration {

  @Bean
  public ScheduledExecutorFactoryBean scheduledExecutorService() {
    return new ScheduledExecutorFactoryBean();
  }

  @Bean
  public TaskScheduler taskScheduler() {
    return new ThreadPoolTaskScheduler();
  }

  @Bean
  public TaskExecutor taskExecutor(@Autowired Context contextHelper) {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(8);
    executor.setMaxPoolSize(200);
    executor.setQueueCapacity(500);
    executor.setThreadNamePrefix("AsyncTask-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setTaskDecorator(new AsyncContextTaskDecorator(contextHelper));
    executor.initialize();
    return executor;
  }

  @Bean
  public TaskExecutor defaultTaskExecutor() {
    return new ConcurrentTaskExecutor(Executors.newWorkStealingPool());
  }
}

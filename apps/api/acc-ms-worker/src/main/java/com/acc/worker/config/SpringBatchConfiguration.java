package com.acc.worker.config;

import com.acc.core.logging.LoggerFactory;
import com.acc.fw.context.AsyncContextTaskDecorator;
import org.slf4j.Logger;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.configuration.support.JobRegistrySmartInitializingSingleton;
import org.springframework.batch.core.configuration.support.MapJobRegistry;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.launch.support.TaskExecutorJobLauncher;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class SpringBatchConfiguration {

  private Logger logger = LoggerFactory.getLogger(SpringBatchConfiguration.class);

  @Bean
  public org.springframework.batch.core.configuration.JobRegistry jobRegistry() {
    return new org.springframework.batch.core.configuration.support.MapJobRegistry();
  }



  @Bean
  public TaskExecutor stepTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(500);
    executor.setThreadNamePrefix("Step-Thread-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.initialize();
    return executor;
  }

  @Bean
  public TaskExecutor jobLauncherTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(200);
    executor.setThreadNamePrefix("Launcher-Thread-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.initialize();
    return executor;
  }

  @Bean
  public JobLauncher jobLauncher(JobRepository jobRepository, @org.springframework.beans.factory.annotation.Qualifier("jobLauncherTaskExecutor") TaskExecutor jobLauncherTaskExecutor) throws Exception {
    TaskExecutorJobLauncher jobLauncher = new TaskExecutorJobLauncher();
    jobLauncher.setJobRepository(jobRepository);
    jobLauncher.setTaskExecutor(jobLauncherTaskExecutor);
    jobLauncher.afterPropertiesSet();
    return jobLauncher;
  }
}

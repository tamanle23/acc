package com.acc.worker;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

//@Component
public class ApplicationStartupRunner implements ApplicationRunner {

  @Autowired
  ApplicationContext applicationContext;

  @Autowired
  JobLauncher jobLauncher;

  @Autowired
  JobOperator jobOperator;

  @Autowired
  JobRepository jobRepository;

  @Override
  public void run(ApplicationArguments args) throws Exception {
    String jobName = "articleScapingJob";
    Job job = (Job) applicationContext.getBean(jobName);
    System.out.println("Starting the batch job");
    try {

      JobParameters jobParameters = new JobParametersBuilder()
                                          .addString("requestId", UUID.randomUUID().toString())
                                          .addString("date", LocalDate.now().format(DateTimeFormatter.ISO_DATE))
                                          .toJobParameters();
//      if(lastExecution == null || !lastExecution.getExitStatus().equals(ExitStatus.UNKNOWN)) {
//        jobOperator.
//      }
      JobExecution execution = jobLauncher.run(job, jobParameters);
      System.out.println("Job Status : " + execution.getStatus());
      System.out.println("Job completed");
    } catch (Exception e) {
      e.printStackTrace();
      System.out.println("Job failed");
    }
  }
}

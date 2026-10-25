package com.acc.presentation.context;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.TimeZone;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.security.core.context.SecurityContextHolder;

import com.acc.domain.constant.SystemConstant;
import com.acc.fw.i18n.InitializableMessageSource;

public class ApplicationContextListener implements ApplicationListener<ApplicationReadyEvent> {

	private static final Logger logger = LoggerFactory.getLogger(ApplicationContextListener.class);

	@Override
	public void onApplicationEvent(ApplicationReadyEvent event) {
		ApplicationContext context = event.getApplicationContext();
		InitializableMessageSource messageSource = context.getBean(InitializableMessageSource.class);
		if(messageSource != null)
			messageSource.initialize();

		try {
			this.initializeSystemFiles();
		} catch (IOException e) {
			logger.error("Cannot initialize system files.",e);
		}
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SecurityContextHolder.setStrategyName(SecurityContextHolder.MODE_INHERITABLETHREADLOCAL);
	}

	private void initializeSystemFiles() throws IOException {
		Path homePath = Paths.get(SystemConstant.PATH_HOME);
		if(!Files.exists(homePath)){
			Files.createDirectory(homePath);
		}
		Path qrDirPath = Paths.get(SystemConstant.PATH_QR_CODE);
		if(!Files.exists(qrDirPath)){
			Files.createDirectory(qrDirPath);
		}
	}
}

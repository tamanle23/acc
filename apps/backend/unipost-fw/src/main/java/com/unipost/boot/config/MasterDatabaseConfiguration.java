package com.unipost.boot.config;

import java.util.HashMap;
import java.util.Properties;

import jakarta.persistence.EntityManagerFactory;
import javax.sql.DataSource;

import org.apache.ibatis.mapping.VendorDatabaseIdProvider;
import org.apache.ibatis.session.SqlSessionFactory;
import org.hibernate.cfg.AvailableSettings;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.boot.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.hibernate.SpringBeanContainer;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;

import com.unipost.presentation.context.UserAuditorAware;

@Configuration
@EnableJpaRepositories(basePackages = {
    "com.unipost" }, entityManagerFactoryRef = "entityManagerFactory", transactionManagerRef = "transactionManager")
// @EntityScan("com.unipost.repository.domain")
@MapperScan(basePackages = "com.unipost.*.repository.mybatis", nameGenerator = BeanNameGenerator.class)
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class MasterDatabaseConfiguration {

  @Autowired
  private Environment env;

  @Bean(name = "masterDatabase")
  @ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "false", matchIfMissing = true)
  @ConfigurationProperties(prefix = "spring.datasource")
  public DataSource dataSource() {
    return DataSourceBuilder.create()
        .url(env.getProperty("spring.datasource.url"))
        .build();
  }

  @Bean(name = "entityManagerFactory")
  public LocalContainerEntityManagerFactoryBean entityManagerFactory(EntityManagerFactoryBuilder builder,
      ConfigurableListableBeanFactory beanFactory, DataSource dataSource) {
    LocalContainerEntityManagerFactoryBean em = builder.dataSource(dataSource)
        .packages("com.unipost")
        .build();
    HibernateJpaVendorAdapter vendorAdapter = new HibernateJpaVendorAdapter();
    em.setJpaVendorAdapter(vendorAdapter);
    em.setJpaPropertyMap(env.getProperty("spring.jpa.properties.hibernate", HashMap.class));
    em.getJpaPropertyMap().put(AvailableSettings.BEAN_CONTAINER, new SpringBeanContainer(beanFactory));
    return em;
  }

  @Bean
  public PlatformTransactionManager transactionManager(
      @Qualifier("entityManagerFactory") EntityManagerFactory entityManagerFactory) {
    return new JpaTransactionManager(entityManagerFactory);
  }

  @Bean
  UserAuditorAware auditorProvider() {
    return new UserAuditorAware();
  }

  @Bean
  public VendorDatabaseIdProvider vendorDatabaseIdProvider() {
    Properties vendorProperties = new Properties();
    vendorProperties.setProperty("PostgreSQL", "postgresql");
    vendorProperties.setProperty("SQL Server", "sqlserver");
    vendorProperties.setProperty("Oracle", "oracle");
    vendorProperties.setProperty("MySQL", "mysql");
    vendorProperties.setProperty("MariaDB", "mariadb");
    VendorDatabaseIdProvider dbIdProvider = new VendorDatabaseIdProvider();
    dbIdProvider.setProperties(vendorProperties);
    return dbIdProvider;
  }

  // @Bean
  // public SqlSessionFactory sqlSessionFactory(DataSource dataSource,
  // ApplicationContext appContext,
  // VendorDatabaseIdProvider vendorDatabaseIdProvider) throws Exception {
  // SqlSessionFactoryBean bean = new SqlSessionFactoryBean();
  // bean.setDataSource(dataSource);
  // bean.setDatabaseIdProvider(vendorDatabaseIdProvider);
  // bean.setConfigLocation("classpath:/mybatis-config.xml");
  // return bean.getObject();
  // }

  // @Bean
  // @Primary
  // JdbcTemplate jdbcTemplate(DataSource dataSource, JdbcProperties properties) {
  // JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
  // JdbcProperties.Template template = properties.getTemplate();
  // jdbcTemplate.setFetchSize(template.getFetchSize());
  // jdbcTemplate.setMaxRows(template.getMaxRows());
  // if (template.getQueryTimeout() != null) {
  // jdbcTemplate.setQueryTimeout((int)template.getQueryTimeout().getSeconds());
  // }
  //
  // return jdbcTemplate;
  // }
}

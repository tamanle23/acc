package com.acc.repository.domain.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import jakarta.inject.Inject;

import com.acc.aio.AppConfig;
import com.acc.repository.domain.article.Article;
import com.acc.fw.test.BaseIntegrationTest;
import com.acc.repository.jpa.article.ArticleRepository;
import com.acc.repository.jpa.article.ArticleTagRepository;
import org.assertj.core.api.Assertions;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.transaction.annotation.Transactional;

import com.github.javafaker.Faker;
import com.google.common.collect.Sets;

@RunWith(SpringJUnit4ClassRunner.class)
@SpringBootTest(properties={"spring.profiles.active=test" ,"spring.cloud.config.uri=http://localhost:8888"}
    ,classes= AppConfig.class)
@Transactional
@TestPropertySource
public class ArticleRepositoryTests extends BaseIntegrationTest{

  private Logger logger = LoggerFactory.getLogger(ArticleRepositoryTests.class);

  Faker faker = new Faker();

  @Inject
  ArticleTagRepository articleTagRepository;

  @Inject
  ArticleRepository articleRepository;

  @Before
  public void setUp(){
  }

  @Test
  public void testArticleRepository_findAllTags() {
    articleRepository.deleteAllInBatch();
    List<Article> articles = new ArrayList<>();
    Article article = new Article();
    article.setContent("Test Content 1");
    article.setTags(Sets.newHashSet("Myth","Fantasy"));
    articles.add(article);
    article = new Article();
    article.setContent("Test Content 2");
    article.setTags(Sets.newHashSet("Myth","Horror"));
    articles.add(article);
    articleRepository.save(articles);
    Set<String> tags = articleTagRepository.findAllTags();
    logger.info(tags.toString());

    Assertions.assertThat(tags).hasSize(3);
  }

}

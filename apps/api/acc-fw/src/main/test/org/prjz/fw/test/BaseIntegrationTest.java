package com.acc.fw.test;

import org.junit.runner.RunWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;

@RunWith(SpringJUnit4ClassRunner.class)
@SpringBootTest(properties={"spring.profiles.active=test","spring.cloud.config.uri=http://localhost:8888"})
public class BaseIntegrationTest {

}

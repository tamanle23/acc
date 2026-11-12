package com.acc.identity.infra.user.repository.mybatis;

import com.acc.fw.mybatis.typehandler.StringSetJsonbTypeHandler;
import com.acc.identity.domain.user.model.UserAggregate;
import com.acc.identity.domain.user.valobj.UserId;
import com.acc.identity.domain.user.valobj.UserStatus;
import com.acc.identity.infra.user.repository.MyBatisUserRepositoryAdapter;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.*;
import org.postgresql.ds.PGSimpleDataSource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

import javax.sql.DataSource;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("UserRepositoryMyBatisTest PostgreSQL Contract Tests")
class UserRepositoryMyBatisTest {

    private static PostgreSQLContainer<?> postgresContainer;
    private static DataSource dataSource;
    private static SqlSessionFactory sqlSessionFactory;
    private SqlSession sqlSession;
    private MyBatisUserRepositoryAdapter repositoryAdapter;

    private static final String TEST_UID = "usr_contract_test_001";
    private static final String TEST_TENANT = "test-tenant-contract";
    private static final String TEST_EMAIL = "contract.test@example.com";
    private static final String TEST_USERNAME = "contract_user_001";

    @BeforeAll
    static void setUpAll() throws Exception {
        boolean dockerAvailable = false;
        try {
            dockerAvailable = DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable t) {
            dockerAvailable = false;
        }

        String jdbcUrl;
        String user;
        String password;

        if (dockerAvailable) {
            postgresContainer = new PostgreSQLContainer<>("postgres:16-alpine")
                .withDatabaseName("unipost")
                .withUsername("postgres")
                .withPassword("postgres");
            postgresContainer.start();
            jdbcUrl = postgresContainer.getJdbcUrl();
            user = postgresContainer.getUsername();
            password = postgresContainer.getPassword();
        } else {
            jdbcUrl = System.getProperty("test.db.url", "jdbc:postgresql://localhost:5432/unipost");
            user = System.getProperty("test.db.username", "postgres");
            password = System.getProperty("test.db.password", "postgres");
        }

        PGSimpleDataSource ds = new PGSimpleDataSource();
        ds.setUrl(jdbcUrl);
        ds.setUser(user);
        ds.setPassword(password);
        dataSource = ds;

        // Ensure table exists for isolated Testcontainers environment
        try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS unipost_identity_user (
                    id SERIAL PRIMARY KEY,
                    uid VARCHAR(64) UNIQUE NOT NULL,
                    mode VARCHAR(64) DEFAULT 'default',
                    username VARCHAR(128) NOT NULL,
                    email VARCHAR(128) NOT NULL,
                    password VARCHAR(256),
                    status SMALLINT DEFAULT 1,
                    deleteddate TIMESTAMP,
                    createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    lastupdateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """);
            stmt.execute("SELECT setval('unipost_identity_user_id_seq', (SELECT COALESCE(MAX(id), 0) + 10 FROM unipost_identity_user));");
        }

        // Build programmatic MyBatis SqlSessionFactory
        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        configuration.getTypeHandlerRegistry().register(UserId.class, new UserIdTypeHandler());
        configuration.getTypeHandlerRegistry().register(UserStatus.class, new UserStatusTypeHandler());
        configuration.getTypeHandlerRegistry().register(Set.class, new StringSetJsonbTypeHandler());

        try (InputStream inputStream = UserRepositoryMyBatisTest.class.getResourceAsStream("/mapper/UserMapper.xml")) {
            if (inputStream == null) {
                throw new IllegalStateException("UserMapper.xml not found on classpath");
            }
            XMLMapperBuilder mapperParser = new XMLMapperBuilder(inputStream, configuration, "/mapper/UserMapper.xml", configuration.getSqlFragments());
            mapperParser.parse();
        }

        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    @AfterAll
    static void tearDownAll() {
        if (postgresContainer != null && postgresContainer.isRunning()) {
            postgresContainer.stop();
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        sqlSession = sqlSessionFactory.openSession(true);
        UserMyBatisMapper mapper = sqlSession.getMapper(UserMyBatisMapper.class);
        repositoryAdapter = new MyBatisUserRepositoryAdapter(mapper);
        cleanTestUser();
    }

    @AfterEach
    void tearDown() throws Exception {
        cleanTestUser();
        if (sqlSession != null) {
            sqlSession.close();
        }
    }

    private void cleanTestUser() throws Exception {
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM unipost_identity_user WHERE uid = ? OR email = ? OR username = ?")) {
            ps.setString(1, TEST_UID);
            ps.setString(2, TEST_EMAIL);
            ps.setString(3, TEST_USERNAME);
            ps.executeUpdate();
        }
    }

    @Test
    @DisplayName("Contract: Save new UserAggregate and find by ID, email, and username")
    void testSaveAndFindUser() {
        long now = System.currentTimeMillis();
        UserAggregate user = new UserAggregate(
            UserId.of(TEST_UID),
            TEST_TENANT,
            TEST_USERNAME,
            TEST_EMAIL,
            "$2a$10$hashedPassword123",
            UserStatus.ACTIVE,
            Set.of("USER", "ADMIN"),
            now,
            now
        );

        // 1. Save (Upsert)
        repositoryAdapter.save(user);

        // 2. Find by ID
        Optional<UserAggregate> foundById = repositoryAdapter.findById(UserId.of(TEST_UID));
        assertTrue(foundById.isPresent(), "User should be found by ID");
        assertEquals(TEST_UID, foundById.get().getId().value());
        assertEquals(TEST_USERNAME, foundById.get().username());
        assertEquals(TEST_EMAIL, foundById.get().email());
        assertEquals(UserStatus.ACTIVE, foundById.get().status());

        // 3. Find by Email (Resolving the former UserRepositoryImpl stub)
        Optional<UserAggregate> foundByEmail = repositoryAdapter.findByEmail(TEST_TENANT, TEST_EMAIL);
        assertTrue(foundByEmail.isPresent(), "User should be found by email");
        assertEquals(TEST_UID, foundByEmail.get().getId().value());

        // 4. Find by Username
        Optional<UserAggregate> foundByUsername = repositoryAdapter.findByUsername(TEST_TENANT, TEST_USERNAME);
        assertTrue(foundByUsername.isPresent(), "User should be found by username");
        assertEquals(TEST_UID, foundByUsername.get().getId().value());

        // 5. Exists check
        assertTrue(repositoryAdapter.existsByEmail(TEST_TENANT, TEST_EMAIL));
        assertTrue(repositoryAdapter.existsByUsername(TEST_TENANT, TEST_USERNAME));
        assertFalse(repositoryAdapter.existsByEmail(TEST_TENANT, "nonexistent@example.com"));
    }

    @Test
    @DisplayName("Contract: Upsert updates existing user on conflict without duplicate key violation")
    void testUpsertOnConflict() {
        long now = System.currentTimeMillis();
        UserAggregate user = new UserAggregate(
            UserId.of(TEST_UID),
            TEST_TENANT,
            TEST_USERNAME,
            TEST_EMAIL,
            "$2a$10$initialHash",
            UserStatus.ACTIVE,
            Set.of("USER"),
            now,
            now
        );

        repositoryAdapter.save(user);

        // Update status via domain method
        user.disable(now + 1000L);
        repositoryAdapter.save(user);

        Optional<UserAggregate> updated = repositoryAdapter.findById(UserId.of(TEST_UID));
        assertTrue(updated.isPresent());
        assertEquals(UserStatus.DISABLED, updated.get().status());
    }
}

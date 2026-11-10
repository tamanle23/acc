package com.acc.fs.infrastructure.adapters.outbound.persistence.mybatis;

import com.acc.fs.domain.model.FsObjectAggregate;
import com.acc.fs.domain.model.valobj.FileId;
import com.acc.fs.infrastructure.adapters.outbound.persistence.MyBatisFsObjectRepositoryAdapter;
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
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("FsObjectRepositoryMyBatisTest PostgreSQL Contract Tests")
class FsObjectRepositoryMyBatisTest {

    private static PostgreSQLContainer<?> postgresContainer;
    private static DataSource dataSource;
    private static SqlSessionFactory sqlSessionFactory;
    private SqlSession sqlSession;
    private MyBatisFsObjectRepositoryAdapter repositoryAdapter;

    private static final String TEST_TENANT = "test-tenant-fs-contract";

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

        // Ensure tables exist for isolated test execution
        try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS unipost_fs_object (
                    id SERIAL PRIMARY KEY,
                    uid VARCHAR(64) UNIQUE NOT NULL,
                    owner_uid VARCHAR(64) NOT NULL DEFAULT 'system',
                    name VARCHAR(256) NOT NULL,
                    is_directory BOOLEAN DEFAULT FALSE,
                    size BIGINT DEFAULT 0,
                    content_type VARCHAR(128) DEFAULT 'application/octet-stream',
                    root_location VARCHAR(512),
                    checksum VARCHAR(128),
                    createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    lastupdateddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleteddate TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS unipost_fs_objectrelation (
                    id SERIAL PRIMARY KEY,
                    parent_uid VARCHAR(64) NOT NULL,
                    child_uid VARCHAR(64) NOT NULL,
                    owner_uid VARCHAR(64)
                );
            """);
        }

        // Build programmatic MyBatis SqlSessionFactory
        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        configuration.getTypeHandlerRegistry().register(FileId.class, new FileIdTypeHandler());

        try (InputStream inputStream = FsObjectRepositoryMyBatisTest.class.getResourceAsStream("/mapper/FsObjectMapper.xml")) {
            if (inputStream == null) {
                throw new IllegalStateException("FsObjectMapper.xml not found on classpath");
            }
            XMLMapperBuilder mapperParser = new XMLMapperBuilder(inputStream, configuration, "/mapper/FsObjectMapper.xml", configuration.getSqlFragments());
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
        FsObjectMyBatisMapper mapper = sqlSession.getMapper(FsObjectMyBatisMapper.class);
        repositoryAdapter = new MyBatisFsObjectRepositoryAdapter(mapper);
        cleanTestData();
    }

    @AfterEach
    void tearDown() throws Exception {
        cleanTestData();
        if (sqlSession != null) {
            sqlSession.close();
        }
    }

    private void cleanTestData() throws Exception {
        try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("DELETE FROM unipost_fs_objectrelation WHERE owner_uid = '" + TEST_TENANT + "'");
            stmt.execute("DELETE FROM unipost_fs_object WHERE owner_uid = '" + TEST_TENANT + "'");
        }
    }

    @Test
    @DisplayName("Should successfully save and retrieve a file FsObjectAggregate")
    void testSaveAndFindFileById() {
        long now = System.currentTimeMillis();
        FileId fileId = FileId.of("file_contract_001");
        FsObjectAggregate file = new FsObjectAggregate(
            fileId, TEST_TENANT, "workspace-a", "sample-video.mp4", null,
            false, 10485760L, "video/mp4", "s3://bucket/videos/sample.mp4",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            now, now
        );

        repositoryAdapter.save(file);

        Optional<FsObjectAggregate> retrievedOpt = repositoryAdapter.findById(fileId);
        assertThat(retrievedOpt).isPresent();

        FsObjectAggregate retrieved = retrievedOpt.get();
        assertThat(retrieved.getId()).isEqualTo(fileId);
        assertThat(retrieved.tenantId()).isEqualTo(TEST_TENANT);
        assertThat(retrieved.name()).isEqualTo("sample-video.mp4");
        assertThat(retrieved.isDirectory()).isFalse();
        assertThat(retrieved.sizeBytes()).isEqualTo(10485760L);
        assertThat(retrieved.contentType()).isEqualTo("video/mp4");
        assertThat(retrieved.storagePath()).isEqualTo("s3://bucket/videos/sample.mp4");
        assertThat(retrieved.checksumSha256()).isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    @Test
    @DisplayName("Should save and retrieve directory object with isDirectory = true")
    void testSaveAndFindDirectory() {
        long now = System.currentTimeMillis();
        FileId dirId = FileId.of("dir_contract_001");
        FsObjectAggregate dir = FsObjectAggregate.createDirectory(TEST_TENANT, "workspace-a", "assets", null, now);
        // Force test dirId
        FsObjectAggregate identifiedDir = new FsObjectAggregate(
            dirId, dir.tenantId(), dir.workspaceId(), dir.name(), dir.parentUid(),
            dir.isDirectory(), dir.sizeBytes(), dir.contentType(), dir.storagePath(),
            dir.checksumSha256(), now, now
        );

        repositoryAdapter.save(identifiedDir);

        Optional<FsObjectAggregate> retrievedOpt = repositoryAdapter.findById(dirId);
        assertThat(retrievedOpt).isPresent();
        assertThat(retrievedOpt.get().isDirectory()).isTrue();
        assertThat(retrievedOpt.get().name()).isEqualTo("assets");
    }

    @Test
    @DisplayName("Should find all child objects by parent UID")
    void testFindAllByParentUid() {
        long now = System.currentTimeMillis();
        FileId parentId = FileId.of("dir_parent_001");
        FsObjectAggregate parentDir = new FsObjectAggregate(
            parentId, TEST_TENANT, "workspace-a", "renders", null,
            true, 0L, "application/x-directory", "", null, now, now
        );
        repositoryAdapter.save(parentDir);

        FileId child1Id = FileId.of("file_child_001");
        FsObjectAggregate child1 = new FsObjectAggregate(
            child1Id, TEST_TENANT, "workspace-a", "clip1.mov", parentId.value(),
            false, 5000000L, "video/quicktime", "s3://b/clip1.mov", "chk1", now, now
        );

        FileId child2Id = FileId.of("file_child_002");
        FsObjectAggregate child2 = new FsObjectAggregate(
            child2Id, TEST_TENANT, "workspace-a", "clip2.mov", parentId.value(),
            false, 7000000L, "video/quicktime", "s3://b/clip2.mov", "chk2", now, now
        );

        repositoryAdapter.save(child1);
        repositoryAdapter.save(child2);

        List<FsObjectAggregate> children = repositoryAdapter.findAllByParentUid(TEST_TENANT, parentId.value());
        assertThat(children).hasSize(2);
        assertThat(children).extracting(FsObjectAggregate::name).containsExactly("clip1.mov", "clip2.mov");
    }

    @Test
    @DisplayName("Should soft-delete FsObject and exclude from subsequent queries")
    void testSoftDeleteById() {
        long now = System.currentTimeMillis();
        FileId fileId = FileId.of("file_del_001");
        FsObjectAggregate file = new FsObjectAggregate(
            fileId, TEST_TENANT, "workspace-a", "to-delete.txt", null,
            false, 100L, "text/plain", "path/to-delete.txt", "chk", now, now
        );

        repositoryAdapter.save(file);
        assertThat(repositoryAdapter.findById(fileId)).isPresent();

        repositoryAdapter.deleteById(fileId);
        assertThat(repositoryAdapter.findById(fileId)).isEmpty();
    }
}

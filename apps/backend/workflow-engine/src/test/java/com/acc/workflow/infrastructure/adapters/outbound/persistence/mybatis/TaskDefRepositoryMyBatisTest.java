package com.acc.workflow.infrastructure.adapters.outbound.persistence.mybatis;

import com.acc.fw.mybatis.typehandler.MapJsonbTypeHandler;
import com.acc.workflow.domain.taskdef.model.TaskDefinitionAggregate;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;
import com.acc.workflow.domain.taskdef.valobj.TaskStatus;
import com.acc.workflow.infrastructure.adapters.outbound.persistence.MyBatisTaskDefinitionRepositoryAdapter;
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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("TaskDefRepositoryMyBatisTest PostgreSQL Contract Tests")
class TaskDefRepositoryMyBatisTest {

    private static PostgreSQLContainer<?> postgresContainer;
    private static DataSource dataSource;
    private static SqlSessionFactory sqlSessionFactory;
    private SqlSession sqlSession;
    private MyBatisTaskDefinitionRepositoryAdapter repositoryAdapter;

    private static final String TEST_TENANT = "test-tenant-taskdef-contract";
    private static final String TEST_NAME_TRANSCODE = "video-transcode-test";
    private static final String TEST_NAME_EXTRACT = "audio-extract-test";

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

        // Ensure table exists
        try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS workflow_task_definitions (
                  task_def_id VARCHAR(128) PRIMARY KEY,
                  tenant_id VARCHAR(64) NOT NULL DEFAULT 'system',
                  name VARCHAR(128) NOT NULL,
                  version INT NOT NULL,
                  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
                  description TEXT,
                  retry_count INT NOT NULL DEFAULT 3,
                  retry_delay_seconds INT NOT NULL DEFAULT 2,
                  backoff_rate DOUBLE PRECISION NOT NULL DEFAULT 2.0,
                  timeout_seconds INT NOT NULL DEFAULT 30,
                  input_schema JSONB,
                  output_schema JSONB,
                  execution_contract JSONB,
                  changelog_note TEXT,
                  published_at_ms BIGINT,
                  published_by VARCHAR(128),
                  created_at_ms BIGINT NOT NULL,
                  updated_at_ms BIGINT NOT NULL,
                  created_by VARCHAR(128) DEFAULT 'SYSTEM',
                  CONSTRAINT uq_workflow_task_def_version UNIQUE (tenant_id, name, version)
                );
            """);
        }

        // Build programmatic MyBatis SqlSessionFactory
        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        configuration.getTypeHandlerRegistry().register(TaskDefId.class, new TaskDefIdTypeHandler());
        configuration.getTypeHandlerRegistry().register(TaskStatus.class, new TaskStatusTypeHandler());
        configuration.getTypeHandlerRegistry().register(Map.class, new MapJsonbTypeHandler());

        try (InputStream inputStream = TaskDefRepositoryMyBatisTest.class.getResourceAsStream("/mapper/TaskDefinitionMapper.xml")) {
            if (inputStream == null) {
                throw new IllegalStateException("TaskDefinitionMapper.xml not found on classpath");
            }
            XMLMapperBuilder mapperParser = new XMLMapperBuilder(inputStream, configuration, "/mapper/TaskDefinitionMapper.xml", configuration.getSqlFragments());
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
        TaskDefinitionMyBatisMapper mapper = sqlSession.getMapper(TaskDefinitionMyBatisMapper.class);
        repositoryAdapter = new MyBatisTaskDefinitionRepositoryAdapter(mapper);
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
            stmt.execute("DELETE FROM workflow_task_definitions WHERE tenant_id = '" + TEST_TENANT + "'");
        }
    }

    @Test
    @DisplayName("Should successfully save and retrieve TaskDefinitionAggregate with JSONB schemas")
    void testSaveAndFindById() {
        TaskDefId id = TaskDefId.of("tdef_contract_001");
        long now = System.currentTimeMillis();
        Map<String, Object> inputSchema = Map.of(
            "type", "object",
            "required", List.of("sourceUrl", "format")
        );
        Map<String, Object> outputSchema = Map.of(
            "type", "object",
            "properties", Map.of("destinationUrl", Map.of("type", "string"))
        );

        TaskDefinitionAggregate aggregate = new TaskDefinitionAggregate(
            id, TEST_TENANT, TEST_NAME_TRANSCODE, 1, TaskStatus.DRAFT,
            "Transcode video to target formats", 3, 5, 2.0, 120,
            inputSchema, outputSchema, Map.of(), "Initial contract creation", now, now
        );

        repositoryAdapter.save(aggregate);

        Optional<TaskDefinitionAggregate> retrievedOpt = repositoryAdapter.findById(id);
        assertThat(retrievedOpt).isPresent();

        TaskDefinitionAggregate retrieved = retrievedOpt.get();
        assertThat(retrieved.getId()).isEqualTo(id);
        assertThat(retrieved.getTenantId()).isEqualTo(TEST_TENANT);
        assertThat(retrieved.getName()).isEqualTo(TEST_NAME_TRANSCODE);
        assertThat(retrieved.getVersion()).isEqualTo(1);
        assertThat(retrieved.getStatus()).isEqualTo(TaskStatus.DRAFT);
        assertThat(retrieved.getDescription()).isEqualTo("Transcode video to target formats");
        assertThat(retrieved.getRetryCount()).isEqualTo(3);
        assertThat(retrieved.getRetryDelaySeconds()).isEqualTo(5);
        assertThat(retrieved.getBackoffRate()).isEqualTo(2.0);
        assertThat(retrieved.getTimeoutSeconds()).isEqualTo(120);
        assertThat(retrieved.getChangelogNote()).isEqualTo("Initial contract creation");
        assertThat(retrieved.getInputSchema()).containsEntry("type", "object");
        assertThat(retrieved.getOutputSchema()).containsEntry("type", "object");
    }

    @Test
    @DisplayName("Should retrieve latest version when multiple versions exist")
    void testFindLatestByName() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate v1 = new TaskDefinitionAggregate(
            TaskDefId.of("tdef_v1"), TEST_TENANT, TEST_NAME_TRANSCODE, 1, TaskStatus.ACTIVE,
            "V1 description", 2, 2, 1.5, 60,
            Map.of(), Map.of(), Map.of(), "v1", now, now
        );
        TaskDefinitionAggregate v2 = new TaskDefinitionAggregate(
            TaskDefId.of("tdef_v2"), TEST_TENANT, TEST_NAME_TRANSCODE, 2, TaskStatus.DRAFT,
            "V2 description", 4, 10, 2.0, 180,
            Map.of(), Map.of(), Map.of(), "v2", now + 1000, now + 1000
        );

        repositoryAdapter.save(v1);
        repositoryAdapter.save(v2);

        Optional<TaskDefinitionAggregate> latestOpt = repositoryAdapter.findLatestByName(TEST_TENANT, TEST_NAME_TRANSCODE);
        assertThat(latestOpt).isPresent();
        assertThat(latestOpt.get().getVersion()).isEqualTo(2);
        assertThat(latestOpt.get().getId()).isEqualTo(TaskDefId.of("tdef_v2"));
    }

    @Test
    @DisplayName("Should find specific task definition by name and version")
    void testFindByNameAndVersion() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate v1 = new TaskDefinitionAggregate(
            TaskDefId.of("tdef_v1_find"), TEST_TENANT, TEST_NAME_TRANSCODE, 1, TaskStatus.ACTIVE,
            "V1", 1, 1, 1.0, 30, Map.of(), Map.of(), Map.of(), "v1", now, now
        );
        TaskDefinitionAggregate v2 = new TaskDefinitionAggregate(
            TaskDefId.of("tdef_v2_find"), TEST_TENANT, TEST_NAME_TRANSCODE, 2, TaskStatus.DRAFT,
            "V2", 2, 2, 2.0, 60, Map.of(), Map.of(), Map.of(), "v2", now, now
        );

        repositoryAdapter.save(v1);
        repositoryAdapter.save(v2);

        Optional<TaskDefinitionAggregate> foundV1 = repositoryAdapter.findByNameAndVersion(TEST_TENANT, TEST_NAME_TRANSCODE, 1);
        assertThat(foundV1).isPresent();
        assertThat(foundV1.get().getVersion()).isEqualTo(1);
        assertThat(foundV1.get().getId()).isEqualTo(TaskDefId.of("tdef_v1_find"));
    }

    @Test
    @DisplayName("Should list all versions of a task ordered ascending")
    void testListVersions() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate v1 = new TaskDefinitionAggregate(
            TaskDefId.of("tdef_seq_1"), TEST_TENANT, TEST_NAME_TRANSCODE, 1, TaskStatus.DEPRECATED,
            "V1", 1, 1, 1.0, 30, Map.of(), Map.of(), Map.of(), "v1", now, now
        );
        TaskDefinitionAggregate v2 = new TaskDefinitionAggregate(
            TaskDefId.of("tdef_seq_2"), TEST_TENANT, TEST_NAME_TRANSCODE, 2, TaskStatus.ACTIVE,
            "V2", 2, 2, 2.0, 60, Map.of(), Map.of(), Map.of(), "v2", now + 10, now + 10
        );

        repositoryAdapter.save(v2);
        repositoryAdapter.save(v1);

        List<TaskDefinitionAggregate> versions = repositoryAdapter.listVersions(TEST_TENANT, TEST_NAME_TRANSCODE);
        assertThat(versions).hasSize(2);
        assertThat(versions.get(0).getVersion()).isEqualTo(1);
        assertThat(versions.get(1).getVersion()).isEqualTo(2);
    }

    @Test
    @DisplayName("Should deprecate all active versions except the specified one")
    void testDeprecateActiveVersionsExcept() {
        long now = System.currentTimeMillis();
        TaskDefId id1 = TaskDefId.of("tdef_act_1");
        TaskDefId id2 = TaskDefId.of("tdef_act_2");

        TaskDefinitionAggregate v1 = new TaskDefinitionAggregate(
            id1, TEST_TENANT, TEST_NAME_TRANSCODE, 1, TaskStatus.ACTIVE,
            "V1", 1, 1, 1.0, 30, Map.of(), Map.of(), Map.of(), "v1", now, now
        );
        TaskDefinitionAggregate v2 = new TaskDefinitionAggregate(
            id2, TEST_TENANT, TEST_NAME_TRANSCODE, 2, TaskStatus.ACTIVE,
            "V2", 2, 2, 2.0, 60, Map.of(), Map.of(), Map.of(), "v2", now + 10, now + 10
        );

        repositoryAdapter.save(v1);
        repositoryAdapter.save(v2);

        repositoryAdapter.deprecateActiveVersionsExcept(TEST_TENANT, TEST_NAME_TRANSCODE, id2, now + 50);

        Optional<TaskDefinitionAggregate> updatedV1 = repositoryAdapter.findById(id1);
        Optional<TaskDefinitionAggregate> updatedV2 = repositoryAdapter.findById(id2);

        assertThat(updatedV1).isPresent();
        assertThat(updatedV1.get().getStatus()).isEqualTo(TaskStatus.DEPRECATED);

        assertThat(updatedV2).isPresent();
        assertThat(updatedV2.get().getStatus()).isEqualTo(TaskStatus.ACTIVE);
    }
}

package com.acc.fs.service.impl;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.RequestWrapper;
import com.acc.fs.connector.StorageConnector;
import com.acc.fs.connector.StorageServiceFactory;
import com.acc.fs.controller.request.FileDropRequestBody;
import com.acc.fs.model.FileAttributes;
import com.acc.fs.model.FileConnector;
import com.acc.fs.model.FsObject;
import com.acc.fs.repository.jpa.FileDirectoryRepository;
import com.acc.fs.repository.jpa.FsObjectRepository;
import com.acc.domain.JpaHelpers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
public class FileServiceImplPerformanceTest {

    @Mock
    private FsObjectRepository fileRepository;

    @Mock
    private FileDirectoryRepository fileDirectoryRepository;

    @Mock
    private JpaHelpers jpaHelpers;

    @Mock
    private StorageServiceFactory storageServiceFactory;

    @Mock
    private StorageConnector storageConnector;

    @InjectMocks
    private FileServiceImpl fileService;

    @Test
    public void testDropFilesPerformance() {
        // Setup mock target
        FsObject target = new FsObject();
        target.setUid("target-uid");
        target.setIsDirectory(true);
        when(fileRepository.findOneByUid("target-uid")).thenReturn(target);

        // Setup mock data for copy
        int fileCount = 100;
        List<FsObject> copyList = new ArrayList<>();
        Set<String> copyUids = new HashSet<>();
        for (int i = 0; i < fileCount; i++) {
            FsObject f = new FsObject();
            f.setUid("copy-uid-" + i);
            f.setPersisted(true);
            FileAttributes attrs = new FileAttributes();
            attrs.setCode("original-code-" + i);
            f.setAttributesJson(attrs);
            copyUids.add(f.getUid());
            copyList.add(f);
        }

        // Setup mock request
        FileDropRequestBody body = new FileDropRequestBody();
        body.setTarget(target);
        body.setCopy(copyList);
        RequestWrapper<ContextHeader, FileDropRequestBody> request = new RequestWrapper<>();
        request.setBody(body);

        when(fileRepository.findAllByUidIn(any())).thenReturn(copyList);
        when(storageServiceFactory.getConnector(FileConnector.DEFAULT_CONNECTOR)).thenReturn(storageConnector);

        // Simulate slow I/O on copy
        when(storageConnector.copy(any())).thenAnswer(invocation -> {
            Thread.sleep(10); // 10ms network/disk latency
            FileAttributes attrs = new FileAttributes();
            attrs.setCode(UUID.randomUUID().toString());
            return attrs;
        });

        ReflectionTestUtils.setField(fileService, "repository", fileRepository);
        when(fileRepository.saveAll(any())).thenReturn(copyList);

        long start = System.currentTimeMillis();
        fileService.dropFiles(request);
        long end = System.currentTimeMillis();

        long timeTaken = end - start;
        System.out.println("Time taken for " + fileCount + " files: " + timeTaken + "ms");
        assertTrue(timeTaken < 1000, "Performance optimization failed: " + timeTaken + "ms");
    }
}

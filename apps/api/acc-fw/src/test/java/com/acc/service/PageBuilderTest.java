package com.acc.service;

import com.acc.core.io.Page;
import com.acc.core.io.PageRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PageBuilderTest {

    private PageBuilder pageBuilder;

    @BeforeEach
    void setUp() {
        pageBuilder = new PageBuilder();
    }

    @Test
    void testPage1_ExactDivision() {
        PageRequest request = new PageRequest();
        request.setNumber(1);
        request.setSize(10);

        Page<String> page = pageBuilder.build(request, () -> 10L, () -> List.of("1", "2", "3", "4", "5", "6", "7", "8", "9", "10"));

        assertNotNull(page);
        assertEquals(10L, page.getTotalElements());
        assertEquals(1L, page.getTotalPages());
        assertEquals(1, page.getNumber());
        assertEquals(10, page.getSize());
        assertEquals(9L, page.getLastOffset());
    }

    @Test
    void testPage2_PopulatesTotalElementsAndCalculatesTotalPages() {
        PageRequest request = new PageRequest();
        request.setNumber(2);
        request.setSize(10);

        Page<String> page = pageBuilder.build(request, () -> 15L, () -> List.of("11", "12", "13", "14", "15"));

        assertNotNull(page);
        assertEquals(15L, page.getTotalElements());
        assertEquals(2L, page.getTotalPages());
        assertEquals(2, page.getNumber());
        assertEquals(10, page.getSize());
        assertEquals(14L, page.getLastOffset());
    }

    @Test
    void testEmptyPage() {
        PageRequest request = new PageRequest();
        request.setNumber(1);
        request.setSize(10);

        Page<String> page = pageBuilder.build(request, () -> 0L, List::of);

        assertNotNull(page);
        assertEquals(0L, page.getTotalElements());
        assertEquals(0L, page.getTotalPages());
    }
}

package com.acc.workflow.adapters;

import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.ports.PersistencePort;

class InMemoryPersistenceTest extends PersistenceContractTest {

    @Override
    protected PersistencePort createPersistencePort() {
        return new InMemoryPersistenceAdapter();
    }
}

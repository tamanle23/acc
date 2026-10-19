import type { AttributeDefinition, EntityRecord, EntityType } from '../api/types';

export const telemetryWideEntityType: EntityType = {
  id: 'telemetry-wide-matrix',
  name: 'IoT Fleet Telemetry (120 Columns)',
  systemName: 'telemetry_wide_matrix',
  description: 'Ultra-wide IoT edge sensory telemetry matrix featuring 120 dynamic metric columns for verifying high-density horizontal table scrolling.',
  schemaVersion: 1,
  version: 1,
  lifecycleConfig: {
    state_field: 'status',
    initial_state: 'ACTIVE',
    states: ['PROVISIONING', 'ACTIVE', 'MAINTENANCE', 'FAULT', 'DECOMMISSIONED'],
    transitions: [
      { from: 'PROVISIONING', to: 'ACTIVE', action: 'COMMISSION' },
      { from: 'ACTIVE', to: 'MAINTENANCE', action: 'DIAGNOSTIC' },
      { from: 'MAINTENANCE', to: 'ACTIVE', action: 'RESTORE' },
      { from: 'ACTIVE', to: 'FAULT', action: 'REPORT_FAULT' },
      { from: 'FAULT', to: 'MAINTENANCE', action: 'SERVICE' },
      { from: '*', to: 'DECOMMISSIONED', action: 'RETIRE', allowed_roles: ['ROLE_ADMIN'] },
    ],
  },
  createdDate: new Date('2026-03-01T00:00:00.000Z').toISOString(),
  updatedDate: new Date('2026-03-25T00:00:00.000Z').toISOString(),
};

// Generate 120 attributes
export const generateWideAttributes = (): AttributeDefinition[] => {
  const attrs: AttributeDefinition[] = [];
  let order = 1;

  // 1. Device Identifiers & Topologies (10 columns)
  const coreAttrs = [
    { name: 'Device UUID', systemName: 'device_uuid', dataType: 'STRING', uiComponent: 'text', isRequired: true },
    { name: 'Serial Number', systemName: 'serial_number', dataType: 'STRING', uiComponent: 'text', isRequired: true },
    { name: 'Hardware Revision', systemName: 'hw_revision', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Firmware Version', systemName: 'fw_version', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Facility Code', systemName: 'facility_code', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Gateway Node ID', systemName: 'gateway_id', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Deployment Zone', systemName: 'deploy_zone', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Rack Position', systemName: 'rack_pos', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Operating Status', systemName: 'status', dataType: 'STRING', uiComponent: 'text', isRequired: true },
    { name: 'Active Profile', systemName: 'active_profile', dataType: 'STRING', uiComponent: 'text' },
  ];

  for (const c of coreAttrs) {
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: c.name,
      systemName: c.systemName,
      dataType: c.dataType as any,
      uiComponent: c.uiComponent as any,
      isRequired: Boolean(c.isRequired),
      displayOrder: order++,
      version: 1,
    });
  }

  // 2. Thermal Core Array (25 columns: temp_core_01 to temp_core_25)
  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Core Temp #${num} (°C)`,
      systemName: `temp_core_${num}`,
      dataType: 'DECIMAL',
      uiComponent: 'number',
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  // 3. Electrical & Power Channels (25 columns: pwr_rail_01 to pwr_rail_25)
  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Power Rail #${num} (mV)`,
      systemName: `pwr_rail_${num}`,
      dataType: 'DECIMAL',
      uiComponent: 'number',
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  // 4. Radio Frequency & Network Packets (25 columns: rf_channel_01 to rf_channel_25)
  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `RF Signal #${num} (dBm)`,
      systemName: `rf_sig_${num}`,
      dataType: 'DECIMAL',
      uiComponent: 'number',
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  // 5. Environmental & Acoustic Vibration (25 columns: vib_freq_01 to vib_freq_25)
  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Vibration Node #${num} (Hz)`,
      systemName: `vib_freq_${num}`,
      dataType: 'DECIMAL',
      uiComponent: 'number',
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  // 6. Diagnostics, Error Hex & Flags (10 columns: diag_flag_01 to diag_flag_10)
  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Diag Status #${num}`,
      systemName: `diag_code_${num}`,
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  return attrs;
};

// Generate realistic mock records for telemetry
export const generateWideRecords = (count = 50): EntityRecord[] => {
  const records: EntityRecord[] = [];
  const zones = ['APAC-SG-01', 'US-EAST-02', 'EU-CENTRAL-01', 'SA-EAST-01', 'AF-SOUTH-01'];
  const statuses = ['ACTIVE', 'MAINTENANCE', 'FAULT', 'PROVISIONING'];

  for (let r = 1; r <= count; r++) {
    const attributes: Record<string, any> = {
      device_uuid: `URN-IOT-${String(1000 + r).padStart(6, '0')}`,
      serial_number: `SN-${String(847290 + r * 13)}`,
      hw_revision: `REV-${r % 3 === 0 ? 'C2' : r % 2 === 0 ? 'B1' : 'A0'}`,
      fw_version: `v3.${(r % 9) + 1}.${r % 12}`,
      facility_code: `FAC-${zones[r % zones.length].slice(0, 4)}-${(r % 4) + 1}`,
      gateway_id: `GW-${String(200 + (r % 10))}`,
      deploy_zone: zones[r % zones.length],
      rack_pos: `U${((r * 2) % 42) + 1}-BAY${(r % 6) + 1}`,
      status: statuses[r % statuses.length],
      active_profile: r % 2 === 0 ? 'HIGH_PERF' : 'ECO_TELEMETRY',
    };

    // Populate the 25 thermal metrics
    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`temp_core_${num}`] = parseFloat((42.5 + (r % 15) * 1.2 + (i % 5) * 0.8).toFixed(1));
    }

    // Populate the 25 electrical rails
    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`pwr_rail_${num}`] = 1200 + (r % 20) * 15 + i * 8;
    }

    // Populate the 25 RF metrics
    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`rf_sig_${num}`] = -1 * (45 + (r % 30) + (i % 12));
    }

    // Populate the 25 Vibration metrics
    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`vib_freq_${num}`] = parseFloat((120.0 + (r % 40) * 2.5 + i * 1.5).toFixed(2));
    }

    // Populate the 10 Diagnostic codes
    for (let i = 1; i <= 10; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`diag_code_${num}`] = r % 7 === 0 && i === 1 ? 'ERR_0x7F4B' : 'OK_0x0000';
    }

    records.push({
      id: String(9000 + r),
      entityTypeId: 'telemetry-wide-matrix',
      tenantId: 'system',
      version: 1,
      attributes,
      createdDate: new Date(2026, 2, (r % 28) + 1).toISOString(),
      updatedDate: new Date(2026, 2, (r % 28) + 1, 14, 30).toISOString(),
    });
  }

  return records;
};

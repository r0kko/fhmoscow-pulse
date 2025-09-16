import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const originalBucket = process.env.S3_BUCKET;

const sendMock = jest.fn();
const getSignedUrlMock = jest.fn();
const uuidMock = jest.fn(() => 'uuid-123');

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  __esModule: true,
  getSignedUrl: getSignedUrlMock,
}));

jest.unstable_mockModule('../src/utils/s3Client.js', () => ({
  __esModule: true,
  default: { send: sendMock },
}));

jest.unstable_mockModule('uuid', () => ({
  __esModule: true,
  v4: uuidMock,
}));

const medicalCertificateFindByPk = jest.fn();
const medicalCertificateTypeFindOne = jest.fn();
const medicalCertificateFileCreate = jest.fn();
const medicalCertificateFileFindByPk = jest.fn();
const medicalCertificateFileFindAll = jest.fn();
const medicalCertificateFileFindOne = jest.fn();

const ticketFindByPk = jest.fn();
const ticketFileCreate = jest.fn();
const ticketFileFindByPk = jest.fn();
const ticketFileFindAll = jest.fn();
const ticketFileFindOne = jest.fn();

const fileCreate = jest.fn();
const fileFindByPk = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  MedicalCertificate: { findByPk: medicalCertificateFindByPk },
  MedicalCertificateType: { findOne: medicalCertificateTypeFindOne },
  MedicalCertificateFile: {
    create: medicalCertificateFileCreate,
    findByPk: medicalCertificateFileFindByPk,
    findAll: medicalCertificateFileFindAll,
    findOne: medicalCertificateFileFindOne,
  },
  Ticket: { findByPk: ticketFindByPk },
  TicketFile: {
    create: ticketFileCreate,
    findByPk: ticketFileFindByPk,
    findAll: ticketFileFindAll,
    findOne: ticketFileFindOne,
  },
  File: {
    create: fileCreate,
    findByPk: fileFindByPk,
  },
}));

const { default: fileService } = await import('../src/services/fileService.js');

beforeAll(() => {
  process.env.S3_BUCKET = 'test-bucket';
});

afterAll(() => {
  process.env.S3_BUCKET = originalBucket;
});

beforeEach(() => {
  sendMock.mockReset();
  getSignedUrlMock.mockReset();
  uuidMock.mockReset().mockReturnValue('uuid-123');
  medicalCertificateFindByPk.mockReset();
  medicalCertificateTypeFindOne.mockReset();
  medicalCertificateFileCreate.mockReset();
  medicalCertificateFileFindByPk.mockReset();
  medicalCertificateFileFindAll.mockReset();
  medicalCertificateFileFindOne.mockReset();
  ticketFindByPk.mockReset();
  ticketFileCreate.mockReset();
  ticketFileFindByPk.mockReset();
  ticketFileFindAll.mockReset();
  ticketFileFindOne.mockReset();
  fileCreate.mockReset();
  fileFindByPk.mockReset();
});

describe('uploadForCertificate', () => {
  const file = {
    size: 1024,
    mimetype: 'application/pdf',
    originalname: 'doc.pdf',
    buffer: Buffer.from('data'),
  };

  test('uploads certificate attachment and stores DB record', async () => {
    medicalCertificateFindByPk.mockResolvedValue({
      id: 'cert1',
      getUser: jest.fn().mockResolvedValue({
        first_name: 'Иван',
        last_name: 'Иванов',
        patronymic: 'Иванович',
      }),
    });
    medicalCertificateTypeFindOne.mockResolvedValue({
      id: 'type1',
      name: 'Медосмотр',
    });
    fileCreate.mockResolvedValue({ id: 'file1' });
    medicalCertificateFileCreate.mockResolvedValue({ id: 'link1' });
    medicalCertificateFileFindByPk.mockResolvedValue({
      id: 'link1',
      File: { id: 'file1' },
    });

    const result = await fileService.uploadForCertificate(
      'cert1',
      file,
      'primary',
      'actor'
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'test-bucket',
          Key: expect.stringContaining('cert1/uuid-123'),
          Body: file.buffer,
          ContentType: 'application/pdf',
        }),
      })
    );
    expect(fileCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('cert1/uuid-123'),
        original_name: expect.stringContaining('Иванов'),
        mime_type: 'application/pdf',
        created_by: 'actor',
      })
    );
    expect(result).toEqual({ id: 'link1', File: { id: 'file1' } });
    expect(medicalCertificateFileFindByPk).toHaveBeenCalledWith('link1', {
      include: [expect.any(Object), expect.any(Object)],
    });
  });

  test('rejects files over limit or with invalid type', async () => {
    await expect(
      fileService.uploadForCertificate(
        'cert',
        { ...file, size: 6 * 1024 * 1024 },
        'primary',
        'actor'
      )
    ).rejects.toMatchObject({ code: 'file_too_large', status: 400 });

    await expect(
      fileService.uploadForCertificate(
        'cert',
        { ...file, mimetype: 'text/plain' },
        'primary',
        'actor'
      )
    ).rejects.toMatchObject({ code: 'invalid_file_type', status: 400 });
  });

  test('fails when certificate or type missing', async () => {
    medicalCertificateFindByPk.mockResolvedValue(null);
    await expect(
      fileService.uploadForCertificate('missing', file, 'primary', 'actor')
    ).rejects.toMatchObject({ code: 'certificate_not_found', status: 404 });

    medicalCertificateFindByPk.mockResolvedValue({
      id: 'cert1',
      getUser: jest.fn().mockResolvedValue({ first_name: 'И', last_name: 'Ф' }),
    });
    medicalCertificateTypeFindOne.mockResolvedValue(null);
    await expect(
      fileService.uploadForCertificate('cert1', file, 'bad', 'actor')
    ).rejects.toMatchObject({ code: 'type_not_found', status: 400 });
  });
});

test('getDownloadUrl signs object key and applies filename', async () => {
  getSignedUrlMock.mockResolvedValue('https://signed');
  const url = await fileService.getDownloadUrl(
    { key: 'path/file.pdf' },
    { filename: 'report.pdf' }
  );
  expect(getSignedUrlMock).toHaveBeenCalledWith(
    { send: expect.any(Function) },
    expect.objectContaining({
      input: {
        Bucket: 'test-bucket',
        Key: 'path/file.pdf',
        ResponseContentDisposition: expect.stringContaining('report.pdf'),
      },
    }),
    { expiresIn: 3600 }
  );
  expect(url).toBe('https://signed');

  await expect(fileService.getDownloadUrl(null)).rejects.toMatchObject({
    code: 'file_not_found',
    status: 404,
  });
});

test('remove deletes certificate file links', async () => {
  const attachment = {
    File: {
      update: jest.fn(),
      destroy: jest.fn(),
    },
    update: jest.fn(),
    destroy: jest.fn(),
  };
  medicalCertificateFileFindOne.mockResolvedValue(attachment);
  await fileService.remove('file1', 'admin');
  expect(attachment.update).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(attachment.File.update).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(attachment.destroy).toHaveBeenCalled();
  expect(attachment.File.destroy).toHaveBeenCalled();

  medicalCertificateFileFindOne.mockResolvedValue(null);
  await expect(fileService.remove('missing')).rejects.toMatchObject({
    code: 'file_not_found',
    status: 404,
  });
});

describe('ticket uploads', () => {
  const file = {
    size: 1024,
    mimetype: 'application/pdf',
    originalname: 'ticket.pdf',
    buffer: Buffer.from('bytes'),
  };

  beforeEach(() => {
    ticketFindByPk.mockReset();
  });

  test('uploadForTicket stores PDF attachment', async () => {
    ticketFindByPk.mockResolvedValue({
      id: 't1',
      getUser: jest
        .fn()
        .mockResolvedValue({ first_name: 'Анна', last_name: 'Смирнова' }),
    });
    fileCreate.mockResolvedValue({ id: 'file2' });
    ticketFileCreate.mockResolvedValue({ id: 'ticket-file-1' });
    ticketFileFindByPk.mockResolvedValue({ id: 'ticket-file-1' });

    const result = await fileService.uploadForTicket('t1', file, 'actor');
    expect(sendMock).toHaveBeenCalled();
    expect(result).toEqual({ id: 'ticket-file-1' });
  });

  test('uploadForNormativeTicket requires video files', async () => {
    ticketFindByPk.mockResolvedValue({
      id: 't2',
      getUser: jest.fn().mockResolvedValue({
        first_name: 'Анна',
        last_name: 'Смирнова',
        patronymic: 'Ивановна',
      }),
    });
    const type = { id: 'typeN', name: 'Норматив' };
    fileCreate.mockResolvedValue({ id: 'file3' });
    ticketFileCreate.mockResolvedValue({ id: 'ticket-file-2' });
    ticketFileFindByPk.mockResolvedValue({ id: 'ticket-file-2' });

    await expect(
      fileService.uploadForNormativeTicket(
        't2',
        { ...file, mimetype: 'video/mp4', size: 10 * 1024 * 1024 },
        'actor',
        { first_name: 'Анна', last_name: 'Смирнова' },
        type
      )
    ).resolves.toEqual({ id: 'ticket-file-2' });

    await expect(
      fileService.uploadForNormativeTicket(
        't2',
        { ...file, mimetype: 'video/mp4', size: 999999999 },
        'actor',
        { first_name: 'Анна', last_name: 'Смирнова' },
        type
      )
    ).rejects.toMatchObject({ code: 'file_too_large' });

    await expect(
      fileService.uploadForNormativeTicket(
        't2',
        { ...file, mimetype: 'application/pdf' },
        'actor',
        { first_name: 'Анна', last_name: 'Смирнова' },
        type
      )
    ).rejects.toMatchObject({ code: 'invalid_file_type' });
  });
});

test('list helpers proxy to ORM', async () => {
  const certFiles = [{ id: 'cf' }];
  const ticketFiles = [{ id: 'tf' }];
  medicalCertificateFileFindAll.mockResolvedValue(certFiles);
  ticketFileFindAll.mockResolvedValue(ticketFiles);
  expect(await fileService.listForCertificate('cert')).toEqual(certFiles);
  expect(await fileService.listForTicket('ticket')).toEqual(ticketFiles);
});

test('removeTicketFile removes associated attachment', async () => {
  const attachment = {
    File: { update: jest.fn(), destroy: jest.fn() },
    update: jest.fn(),
    destroy: jest.fn(),
  };
  ticketFileFindOne.mockResolvedValue(attachment);
  await fileService.removeTicketFile('f1', 'actor');
  expect(attachment.update).toHaveBeenCalledWith({ updated_by: 'actor' });
  expect(attachment.destroy).toHaveBeenCalled();
  ticketFileFindOne.mockResolvedValue(null);
  await expect(fileService.removeTicketFile('missing')).rejects.toMatchObject({
    code: 'file_not_found',
  });
});

test('uploadDocument enforces type and stores file', async () => {
  fileCreate.mockResolvedValue({ id: 'doc-file' });
  const file = {
    size: 1024,
    mimetype: 'image/png',
    originalname: 'screen.png',
    buffer: Buffer.from('png'),
  };
  const result = await fileService.uploadDocument(file, 'actor');
  expect(sendMock).toHaveBeenCalled();
  expect(result).toEqual({ id: 'doc-file' });
  await expect(
    fileService.uploadDocument({ ...file, mimetype: 'text/plain' }, 'actor')
  ).rejects.toMatchObject({ code: 'invalid_file_type' });
});

test('removeFile destroys S3 object and record if found', async () => {
  const destroy = jest.fn();
  fileFindByPk.mockResolvedValue({ key: 'documents/x.pdf', destroy });
  await fileService.removeFile('file-1');
  expect(sendMock).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'documents/x.pdf',
      }),
    })
  );
  expect(destroy).toHaveBeenCalled();

  fileFindByPk.mockResolvedValue(null);
  await fileService.removeFile('missing');
});

test('saveGeneratedPdf uploads buffer with deterministic name', async () => {
  fileCreate.mockResolvedValue({ id: 'final' });
  const buffer = Buffer.from('pdf-data');
  const result = await fileService.saveGeneratedPdf(
    buffer,
    'report.pdf',
    'actor'
  );
  expect(sendMock).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({
        Key: expect.stringContaining('documents/uuid-123'),
        ContentType: 'application/pdf',
      }),
    })
  );
  expect(fileCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      original_name: 'report.pdf',
      size: buffer.length,
    })
  );
  expect(result).toEqual({ id: 'final' });
});

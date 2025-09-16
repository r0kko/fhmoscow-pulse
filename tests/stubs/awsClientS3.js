export class S3Client {
  constructor(config = {}) {
    this.config = config;
  }

  async send() {
    throw new Error('S3Client mock cannot perform send without override');
  }
}

class BaseCommand {
  constructor(input) {
    this.input = input;
  }
}

export class PutObjectCommand extends BaseCommand {}
export class GetObjectCommand extends BaseCommand {}
export class DeleteObjectCommand extends BaseCommand {}

export default {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
};

# VM-X CLI

The VM-X CLI is a command line interface designed to help developers generate AI projects using the industry's best practices and most commonly used patterns.

## Installation

You can use VM-X CLI either directly via npx or by installing it globally.

**Using npx:**

```bash
npx vm-x-ai --help
```

**Installing globally:**

```bash
npm install -g vm-x-ai
vm-x-ai --help
```

## Commands

- `generate [name]`: Generates a new project.

## Options

- `--help`: Displays help information.
- `--version`: Shows the version number.
- `-v`, `--verbose`: Enables verbose output for debugging purposes.

### Generate Command

Generate AI projects for data extraction from files, with setup based on this documentation: [AI Extraction Documentation](https://github.com/vm-x-ai/vm-x-ai-labs/blob/main/packages/aws/cdk/constructs/README.md#similarityextractionworkflow).

#### AI Extraction

Generates a project for AWS Serverless Components (via CDK) using Python Lambda functions. You can choose between a monorepo or a single repository structure.

##### Monorepo

Recommended for managing multiple projects within the same git repository to share code and dependencies.

Currently, we support the [Nx](https://nx.dev/) monorepo with the [@nxlv/python](https://www.npmjs.com/package/@nxlv/python) package for Python support.

#### Options for AI Extraction

```text
vm-x-ai generate ai-extraction [name]

Generate a new AI extraction project.

Positionals:
  name  Project name. Must be a valid folder name.                     [string]

Options:
  --help           Show help                                          [boolean]
  --version        Show version number                                [boolean]
  -v, --verbose    Enable verbose logging                             [boolean]
  --provider       Cloud provider                  [string] [choices: "aws"]
  --monorepo-tool  Monorepo tool                    [string] [choices: "nx"]
  --language       Programming language          [string] [choices: "python"]
  --deploy         Automatically deploy project after generation      [boolean]
  --interactive    Enable interactive mode          [boolean] [default: true]
  --aws-profile    Specify AWS profile (only with AWS provider)        [string]
  --aws-region     Specify AWS region (only with AWS provider)        [string]
```

#### Example Usage

```bash
vm-x-ai generate ai-extraction my-project
```

**NOTE**: The project name is used for both the folder and the repository name and must be a valid directory name.

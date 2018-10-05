const path = require('path');
const ts = require('typescript');
const { Linter, Configuration } = require('tslint');
const {WolfLinter, WolfLinterError} = require(path.join(binPath, 'wolflinter'));

/*
------------------------------------------
------------ FORMATTER TYPES -------------
------------------------------------------

# "json" - prints stringified JSON to console.log.
# "prose" - prints short human-readable failures to console.log.
# "verbose" - prints longer human-readable failures to console.log.
# "msbuild" - for Visual Studio
# "vso" - outputs failures in a format that can be integrated with Visual Studio Online.
# "checkstyle" - for the Checkstyle development tool
# "pmd" - for the PMD source code analyzer
# "stylish" - human-readable formatter which creates stylish messages.
*/

const _private = new WeakMap();
class WolfTSLint extends WolfLinter {

    constructor() {
        super();

        this.options = {
            fix: false,
            formatter: "stylish",
            formattersDirectory: null,
            rulesDirectory: "./",
            exclude: [
                "node_modules"
            ]
        };

        _private.set(this, {

            /** @private { ts.Program } _program **/
            _program: Linter.createProgram(path.join(__dirname, "tsconfig.json"), testPath),

            /** @private { Function } _processLinterResults **/
            _processLinterResults: (fail) => {
                const { failure, name, ruleName, startPosition } = fail.toJson();
                const { character, line, position } = startPosition;

                return new WolfLinterError(failure, name, ruleName, {character: character+1, line: line+1, position: position+1});
            },

            /** @private { Function } _processCompilerResults **/
            _processCompilerResults: (fail) => {
                let _line = 0, _character = 0, _fileName = '';
                const message = ts.flattenDiagnosticMessageText(fail.messageText, "\n");

                if (fail.file) {
                    const { line, character } = fail.file.getLineAndCharacterOfPosition(fail.start);
                    const { fileName } = fail.file;

                    _line = line;
                    _character = character;
                    _fileName = fileName;
                }

                // TODO: Treure aquesta linea quan aconsegueixi que ignori el puto node_modules
                if (_fileName.includes("node_modules")) {
                    return null;
                }

                return new WolfLinterError(message, _fileName, "compiler", {character: _character+1, line: _line+1, position: 0});
            }

        });
    }

    track() {
        const linter = new Linter(this.options, _private.get(this)._program);
        const files = Linter.getFileNames(_private.get(this)._program);

        files.forEach(file => {
            const fileContents = _private.get(this)._program.getSourceFile(file).getFullText();
            const configuration = Configuration.findConfiguration(path.join(__dirname, "tslint.json"), file).results;
            linter.lint(file, fileContents, configuration);
        });

        const results = linter.getResult();
        const emitResults = _private.get(this)._program.emit();
        const allDiag = ts.getPreEmitDiagnostics(_private.get(this)._program).concat(emitResults.diagnostics);

        allDiag.map(_private.get(this)._processCompilerResults)
               .concat(results.failures.map(_private.get(this)._processLinterResults))
               //.forEach((error) => this.addErrors(error));
               .forEach((error) => error ? this.addErrors(error): null);
        // TODO: Treure aquesta linea quan aconsegueixi que ignori el puto node_modules i descomentar la anterior.
    }


}

module.exports = WolfTSLint;



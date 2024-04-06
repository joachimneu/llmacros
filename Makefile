.PHONY: build publish

build:
	npx vsce package
	mv -v *.vsix build/

publish:
	npx vsce publish patch

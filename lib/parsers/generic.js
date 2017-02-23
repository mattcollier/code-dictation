'use babel'

import fs from 'fs'
import path from 'path'

export default class GenericParser {
  constructor ({editor, view}) {
    Object.assign(this, {
      editor,
      likeWordsDictionary: this.loadDictionary('like-words'),
      lineJumps: this.loadDictionary('line-jumps'),
      numberDictionary: this.loadDictionary('number'),
      state: this.startProcessor,
      view
    })
  }

  insertText (text) {
    this.editor.insertText(text)
  }

  loadDictionary (name, grammar) {
    const basePath = path.join(__dirname, '..', 'dictionaries')
    const fileName = `${name}.json`
    const filePath = grammar ? path.join(basePath, grammar, fileName) : path.join(basePath, fileName)
    return JSON.parse(
      fs.readFileSync(filePath, {encoding: 'utf8'})
    )
  }

  normalizeNumber (word) {
    if (/^\d+$/.test(word)) {
      return parseInt(word)
    }

    if (word in this.numberDictionary) {
      return this.numberDictionary[word]
    }

    return null
  }

  process ({cancel, text}) {
    text.toLowerCase().split(' ').forEach((word) => {
      console.debug(word)
      this.state = this.state({cancel, word}) || this.state
    })

    if (this.state === this.startProcessor) {
      this.view.clearWords()
    }
  }

  soundsLike (expected, actual) {
    if (actual === expected) return true
    const likeWords = this.likeWordsDictionary[expected]
    if (!likeWords) return false
    return likeWords.indexOf(actual) !== -1
  }

  // Helpers

  goToLine (line) {
    // Don't let user try to access a line before the first one (line 1)
    line = Math.max(1, line) // Don't let line go below 0

    // Don't let line go beyond number of lines in editor
    line = Math.min(line, this.editor.getLineCount())

    // Move cursor to begininning of line specified by user
    this.editor.setCursorScreenPosition([line - 1, 0])
  }

  // Processor methods

  goProcessor ({cancel, word}) {
    const nextStates = {
      to: this.goToProcessor
    }

    const nextStateKeys = Object.keys(nextStates)

    for (let i = 0; i < nextStateKeys.length; i++) {
      if (this.soundsLike(nextStateKeys[i], word)) {
        cancel()
        this.view.addWords(nextStateKeys[i])
        return nextStates[nextStateKeys[i]]
      }
    }

    // "to line"
    if (word === 'lunchtime') {
      cancel()
      this.view.addWords('to', 'line')
      return this.goToLineProcessor
    }
  }

  goToLineProcessor ({cancel, word}) {
    if (/^\d+$/.test(word)) {
      cancel()
      const line = parseInt(word.match(/\d+/)[0])
      this.goToLine(line)
      return this.startProcessor
    }

    const number = this.normalizeNumber(word)

    if (number) {
      cancel()
      this.goToLine(number)
      return this.startProcessor
    }
  }

  goToProcessor ({cancel, word}) {
    const nextStates = {
      line: this.goToLineProcessor
    }

    const nextStateKeys = Object.keys(nextStates)

    for (let i = 0; i < nextStateKeys.length; i++) {
      if (this.soundsLike(nextStateKeys[i], word)) {
        cancel()
        this.view.addWords(nextStateKeys[i])
        return nextStates[nextStateKeys[i]]
      }
    }

    if (word in this.lineJumps) {
      cancel()
      goToLine(this.lineJumps[word])
      return this.startProcessor
    }
  }

  startProcessor ({cancel, word}) {
    const nextStates = {
      go: this.goProcessor,
      line: this.goToLineProcessor
    }

    const nextStateKeys = Object.keys(nextStates)

    for (let i = 0; i < nextStateKeys.length; i++) {
      if (this.soundsLike(nextStateKeys[i], word)) {
        cancel()
        this.view.addWords(nextStateKeys[i])
        return nextStates[nextStateKeys[i]]
      }
    }

    if (this.soundsLike('down', word)) {
      cancel()
      this.goToLine(this.editor.getCursorScreenPosition().row + 2)
      return this.startProcessor
    }

    if (this.soundsLike('up', word)) {
      cancel()
      this.goToLine(this.editor.getCursorScreenPosition().row)
      return this.startProcessor
    }

    if (word in this.lineJumps) {
      cancel()
      goToLine(this.lineJumps[word])
      return this.startProcessor
    }
  }
}

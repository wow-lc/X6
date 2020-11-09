import Mousetrap from 'mousetrap'
import { Disposable, IDisablable } from '../common'
import { Dom, FunctionExt } from '../util'
import { Graph } from './index'

export class Keyboard extends Disposable implements IDisablable {
  public readonly target: HTMLElement | Document
  public readonly container: HTMLElement
  public readonly mousetrap: MousetrapInstance

  protected get graph() {
    return this.options.graph
  }

  constructor(public readonly options: Keyboard.Options) {
    super()

    const scroller = this.graph.scroller.widget
    this.container = scroller ? scroller.container : this.graph.container

    if (options.global) {
      this.target = document
    } else {
      this.target = this.container
      if (!this.disabled) {
        // ensure the container focusable
        this.target.setAttribute('tabindex', '-1')
      }

      this.graph.on('cell:mousedown', this.focus, this)
      this.graph.on('blank:mousedown', this.focus, this)
    }

    this.mousetrap = Keyboard.createMousetrap(this)
  }

  get disabled() {
    return this.options.enabled !== true
  }

  enable() {
    if (this.disabled) {
      this.options.enabled = true
      this.graph.options.keyboard.enabled = true
      if (this.target instanceof HTMLElement) {
        this.target.setAttribute('tabindex', '-1')
      }
    }
  }

  disable() {
    if (!this.disabled) {
      this.options.enabled = false
      this.graph.options.keyboard.enabled = false
      if (this.target instanceof HTMLElement) {
        this.target.removeAttribute('tabindex')
      }
    }
  }

  on(
    keys: string | string[],
    callback: Keyboard.Handler,
    action?: Keyboard.Action,
  ) {
    this.mousetrap.bind(this.getKeys(keys), callback, action)
  }

  off(keys: string | string[], action?: Keyboard.Action) {
    this.mousetrap.unbind(this.getKeys(keys), action)
  }

  private focus() {
    const target = this.target as HTMLElement
    target.focus()
  }

  private getKeys(keys: string | string[]) {
    return (Array.isArray(keys) ? keys : [keys]).map((key) =>
      this.formatkey(key),
    )
  }

  protected formatkey(key: string) {
    const formated = key
      .toLowerCase()
      .replace(/\s/g, '')
      .replace('delete', 'del')
      .replace('cmd', 'command')

    const formatFn = this.options.format
    if (formatFn) {
      return FunctionExt.call(formatFn, this.graph, formated)
    }

    return formated
  }

  protected isGraphEvent(e: KeyboardEvent) {
    const target = (e.srcElement || e.target) as Element
    if (target) {
      if (target === this.target || target.parentElement === this.target) {
        return true
      }

      return Dom.contains(this.container, target)
    }

    return false
  }

  isEnabledForEvent(e: KeyboardEvent) {
    const allowed = !this.disabled && this.isGraphEvent(e)
    if (allowed) {
      if (this.options.guard) {
        return FunctionExt.call(this.options.guard, this.graph, e)
      }
    }
    return allowed
  }

  @Disposable.dispose()
  dispose() {
    this.mousetrap.reset()
  }
}

export namespace Keyboard {
  export type Action = 'keypress' | 'keydown' | 'keyup'
  export type Handler = (e: KeyboardEvent) => void

  export interface Options {
    graph: Graph
    enabled?: boolean

    /**
     * Specifies if keyboard event should bind on docuemnt or on container.
     *
     * Default is `false` that will bind keyboard event on the container.
     */
    global?: boolean

    format?: (this: Graph, key: string) => string
    guard?: (this: Graph, e: KeyboardEvent) => boolean
  }
}

export namespace Keyboard {
  export function createMousetrap(keyboard: Keyboard) {
    const mousetrap = new Mousetrap(keyboard.target as Element)
    const stopCallback = mousetrap.stopCallback
    mousetrap.stopCallback = (
      e: KeyboardEvent,
      elem: HTMLElement,
      combo: string,
    ) => {
      if (keyboard.isEnabledForEvent(e)) {
        if (stopCallback) {
          return stopCallback.call(mousetrap, e, elem, combo)
        }
      }
      return false
    }

    return mousetrap
  }
}
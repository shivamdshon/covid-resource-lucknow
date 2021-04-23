var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const POPULAR_CITIES = [
      'lucknow',
      'hazratganj',
      'rajajipuram',
      'Gomti Nagar',
      'Faizabad Road',
      'Aliganj',
      'Kursi Road',
      'Sitapur Road',
      'Nishat Ganj',
      'Jankipuram',
      'Kanpur',
      'Alamnagar',
      'Mahanagar',
      'Vikas Nagar',
      'Hazratganj',
      'Aishbagh',
      'Indira Nagar',
      'Chinhat',
      'Ashiyana',
      'Nirala Nagar',
      'Rajajipuram',
      'Vasant Kunj',
      'Sector B Lucknow',
      'Gosainganj',
      'Balaganj',
      'Bakshi Ka Talab',
      'Daliganj',
      'Alambagh',
      'Aminabad',
      'Amausi',
      'Chowk',
      'Krishna Nagar',
      'Kakori',
      'Lalbagh',
    ];

    function capitalCase(string) {
      if (!string) {
        return string;
      }

      return string[0].toUpperCase() + string.slice(1);
    }

    const STORAGE_KEY = {
      generated_links: 'generated_links',
    };

    const LocalStorage = {
      /**
       *
       * @param key
       * @param value
       * @returns {*}
       */
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch(e) {}

        return value;
      },

      /**
       *
       * @param key
       * @param defaultValue
       * @returns {any}
       */
      getItem: (key, defaultValue) => {
        try {
          const value = localStorage.getItem(key);
          if (value === null || typeof value === "undefined") {
            return defaultValue;
          }
          return JSON.parse(value);
        } catch (e) {}

        return defaultValue;
      },

      /**
       *
       * @param key
       */
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
      }
    };

    /* App.svelte generated by Svelte v3.37.0 */

    const { Object: Object_1 } = globals;
    const file = "App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	child_ctx[26] = list;
    	child_ctx[27] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	child_ctx[28] = list;
    	child_ctx[29] = i;
    	return child_ctx;
    }

    // (354:10) {#each Object.keys(alsoSearchFor) as item (item)}
    function create_each_block_3(key_1, ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let t0;
    	let label;
    	let t1_value = capitalCase(/*item*/ ctx[25]) + "";
    	let t1;
    	let label_for_value;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[9].call(input, /*item*/ ctx[25]);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			t1 = text(t1_value);
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "id", input_id_value = `alsoSearchFor-${/*item*/ ctx[25]}`);
    			attr_dev(input, "class", "svelte-ykqlu7");
    			add_location(input, file, 355, 14, 6987);
    			attr_dev(label, "for", label_for_value = `alsoSearchFor-${/*item*/ ctx[25]}`);
    			attr_dev(label, "class", "svelte-ykqlu7");
    			add_location(label, file, 356, 14, 7099);
    			attr_dev(div, "class", "svelte-ykqlu7");
    			add_location(div, file, 354, 12, 6967);
    			this.first = div;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			input.checked = /*alsoSearchFor*/ ctx[2][/*item*/ ctx[25]].checked;
    			append_dev(div, t0);
    			append_dev(div, label);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*alsoSearchFor*/ 4 && input_id_value !== (input_id_value = `alsoSearchFor-${/*item*/ ctx[25]}`)) {
    				attr_dev(input, "id", input_id_value);
    			}

    			if (dirty & /*alsoSearchFor, Object*/ 4) {
    				input.checked = /*alsoSearchFor*/ ctx[2][/*item*/ ctx[25]].checked;
    			}

    			if (dirty & /*alsoSearchFor*/ 4 && t1_value !== (t1_value = capitalCase(/*item*/ ctx[25]) + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*alsoSearchFor*/ 4 && label_for_value !== (label_for_value = `alsoSearchFor-${/*item*/ ctx[25]}`)) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(354:10) {#each Object.keys(alsoSearchFor) as item (item)}",
    		ctx
    	});

    	return block;
    }

    // (371:10) {#each Object.keys(excludeKeywords) as item (item)}
    function create_each_block_2(key_1, ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let t0;
    	let label;
    	let t1;
    	let t2_value = /*item*/ ctx[25] + "";
    	let t2;
    	let t3;
    	let label_for_value;
    	let mounted;
    	let dispose;

    	function input_change_handler_1() {
    		/*input_change_handler_1*/ ctx[11].call(input, /*item*/ ctx[25]);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			t1 = text("\"");
    			t2 = text(t2_value);
    			t3 = text("\"");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "id", input_id_value = `excludeKeywords-${/*item*/ ctx[25]}`);
    			attr_dev(input, "class", "svelte-ykqlu7");
    			add_location(input, file, 372, 14, 7582);
    			attr_dev(label, "for", label_for_value = `excludeKeywords-${/*item*/ ctx[25]}`);
    			attr_dev(label, "class", "svelte-ykqlu7");
    			add_location(label, file, 373, 14, 7698);
    			attr_dev(div, "class", "svelte-ykqlu7");
    			add_location(div, file, 371, 12, 7562);
    			this.first = div;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			input.checked = /*excludeKeywords*/ ctx[3][/*item*/ ctx[25]].checked;
    			append_dev(div, t0);
    			append_dev(div, label);
    			append_dev(label, t1);
    			append_dev(label, t2);
    			append_dev(label, t3);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler_1);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*excludeKeywords*/ 8 && input_id_value !== (input_id_value = `excludeKeywords-${/*item*/ ctx[25]}`)) {
    				attr_dev(input, "id", input_id_value);
    			}

    			if (dirty & /*excludeKeywords, Object*/ 8) {
    				input.checked = /*excludeKeywords*/ ctx[3][/*item*/ ctx[25]].checked;
    			}

    			if (dirty & /*excludeKeywords*/ 8 && t2_value !== (t2_value = /*item*/ ctx[25] + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*excludeKeywords*/ 8 && label_for_value !== (label_for_value = `excludeKeywords-${/*item*/ ctx[25]}`)) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(371:10) {#each Object.keys(excludeKeywords) as item (item)}",
    		ctx
    	});

    	return block;
    }

    // (414:6) {#if links.length > 0}
    function create_if_block(ctx) {
    	let h2;
    	let t1;
    	let ol;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t2;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*links*/ ctx[4];
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*link*/ ctx[20].href;
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Your Generated Links";
    			t1 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			button = element("button");
    			button.textContent = "Clear saved links";
    			attr_dev(h2, "class", "svelte-ykqlu7");
    			add_location(h2, file, 414, 8, 8982);
    			attr_dev(ol, "id", "city-links");
    			attr_dev(ol, "class", "svelte-ykqlu7");
    			add_location(ol, file, 416, 8, 9021);
    			attr_dev(button, "class", "svelte-ykqlu7");
    			add_location(button, file, 422, 8, 9239);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, ol, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}

    			insert_dev(target, t2, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*clearSavedLinks*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*links, capitalCase*/ 16) {
    				each_value_1 = /*links*/ ctx[4];
    				validate_each_argument(each_value_1);
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, ol, destroy_block, create_each_block_1, null, get_each_context_1);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ol);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(414:6) {#if links.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (418:10) {#each links as link (link.href)}
    function create_each_block_1(key_1, ctx) {
    	let li;
    	let a;
    	let t_value = capitalCase(/*link*/ ctx[20].city) + "";
    	let t;
    	let a_href_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[20].href);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noopener noreferrer");
    			attr_dev(a, "class", "svelte-ykqlu7");
    			add_location(a, file, 418, 16, 9102);
    			attr_dev(li, "class", "svelte-ykqlu7");
    			add_location(li, file, 418, 12, 9098);
    			this.first = li;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*links*/ 16 && t_value !== (t_value = capitalCase(/*link*/ ctx[20].city) + "")) set_data_dev(t, t_value);

    			if (dirty & /*links*/ 16 && a_href_value !== (a_href_value = /*link*/ ctx[20].href)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(418:10) {#each links as link (link.href)}",
    		ctx
    	});

    	return block;
    }

    // (430:8) {#each popularCityLinks as link (link.href)}
    function create_each_block(key_1, ctx) {
    	let li;
    	let a;
    	let t_value = capitalCase(/*link*/ ctx[20].city) + "";
    	let t;
    	let a_href_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[20].href);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noopener noreferrer");
    			attr_dev(a, "class", "svelte-ykqlu7");
    			add_location(a, file, 430, 14, 9486);
    			attr_dev(li, "class", "svelte-ykqlu7");
    			add_location(li, file, 430, 10, 9482);
    			this.first = li;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*popularCityLinks*/ 32 && t_value !== (t_value = capitalCase(/*link*/ ctx[20].city) + "")) set_data_dev(t, t_value);

    			if (dirty & /*popularCityLinks*/ 32 && a_href_value !== (a_href_value = /*link*/ ctx[20].href)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(430:8) {#each popularCityLinks as link (link.href)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let body;
    	let main;
    	let h1;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let br1;
    	let strong0;
    	let t4;
    	let div15;
    	let div10;
    	let div0;
    	let h20;
    	let t6;
    	let ol0;
    	let li0;
    	let strong1;
    	let t8;
    	let li1;
    	let t10;
    	let li2;
    	let t11;
    	let br2;
    	let t12;
    	let img;
    	let img_src_value;
    	let t13;
    	let h21;
    	let t15;
    	let form;
    	let div1;
    	let label0;
    	let t17;
    	let br3;
    	let t18;
    	let input0;
    	let t19;
    	let div3;
    	let t20;
    	let each_blocks_2 = [];
    	let each0_lookup = new Map();
    	let t21;
    	let div2;
    	let label1;
    	let t23;
    	let input1;
    	let t24;
    	let div5;
    	let t25;
    	let strong2;
    	let t27;
    	let each_blocks_1 = [];
    	let each1_lookup = new Map();
    	let t28;
    	let div4;
    	let label2;
    	let t30;
    	let input2;
    	let t31;
    	let div6;
    	let input3;
    	let t32;
    	let label3;
    	let t34;
    	let div7;
    	let input4;
    	let t35;
    	let label4;
    	let t36;
    	let br4;
    	let t37;
    	let strong3;
    	let t39;
    	let br5;
    	let t40;
    	let t41;
    	let div8;
    	let input5;
    	let t42;
    	let label5;
    	let t43;
    	let br6;
    	let t44;
    	let t45;
    	let div9;
    	let button;
    	let t47;
    	let t48;
    	let div11;
    	let h22;
    	let t50;
    	let ol1;
    	let each_blocks = [];
    	let each2_lookup = new Map();
    	let t51;
    	let h3;
    	let t53;
    	let div12;
    	let h23;
    	let t55;
    	let ul0;
    	let li3;
    	let a0;
    	let t56;
    	let br7;
    	let br8;
    	let t57;
    	let t58;
    	let ul1;
    	let li4;
    	let a1;
    	let t60;
    	let div13;
    	let h24;
    	let t62;
    	let ul2;
    	let li5;
    	let a2;
    	let t63;
    	let br9;
    	let br10;
    	let t64;
    	let t65;
    	let ul3;
    	let li6;
    	let a3;
    	let t67;
    	let div14;
    	let h25;
    	let t69;
    	let ul4;
    	let li7;
    	let a4;
    	let t71;
    	let t72;
    	let div19;
    	let div16;
    	let a5;
    	let t74;
    	let div17;
    	let t75;
    	let a6;
    	let t77;
    	let t78;
    	let div18;
    	let t79;
    	let a7;
    	let mounted;
    	let dispose;
    	let each_value_3 = Object.keys(/*alsoSearchFor*/ ctx[2]);
    	validate_each_argument(each_value_3);
    	const get_key = ctx => /*item*/ ctx[25];
    	validate_each_keys(ctx, each_value_3, get_each_context_3, get_key);

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		let child_ctx = get_each_context_3(ctx, each_value_3, i);
    		let key = get_key(child_ctx);
    		each0_lookup.set(key, each_blocks_2[i] = create_each_block_3(key, child_ctx));
    	}

    	let each_value_2 = Object.keys(/*excludeKeywords*/ ctx[3]);
    	validate_each_argument(each_value_2);
    	const get_key_1 = ctx => /*item*/ ctx[25];
    	validate_each_keys(ctx, each_value_2, get_each_context_2, get_key_1);

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		let child_ctx = get_each_context_2(ctx, each_value_2, i);
    		let key = get_key_1(child_ctx);
    		each1_lookup.set(key, each_blocks_1[i] = create_each_block_2(key, child_ctx));
    	}

    	let if_block = /*links*/ ctx[4].length > 0 && create_if_block(ctx);
    	let each_value = /*popularCityLinks*/ ctx[5];
    	validate_each_argument(each_value);
    	const get_key_2 = ctx => /*link*/ ctx[20].href;
    	validate_each_keys(ctx, each_value, get_each_context, get_key_2);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key_2(child_ctx);
    		each2_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			body = element("body");
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Lucknow - Covid Resources Finder";
    			t1 = space();
    			p = element("p");
    			t2 = text("This is a remastered & modified version for finding covid resources in all areas of Lucknow.");
    			br0 = element("br");
    			br1 = element("br");
    			strong0 = element("strong");
    			strong0.textContent = "Please note, I hold no copyrights.";
    			t4 = space();
    			div15 = element("div");
    			div10 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Tips";
    			t6 = space();
    			ol0 = element("ol");
    			li0 = element("li");
    			strong1 = element("strong");
    			strong1.textContent = "Do NOT make advanced payments unless you are 100% sure about their authenticity";
    			t8 = space();
    			li1 = element("li");
    			li1.textContent = "Check for replies under the tweets";
    			t10 = space();
    			li2 = element("li");
    			t11 = text("Make sure search results are sorted by \"Latest\"\n            ");
    			br2 = element("br");
    			t12 = space();
    			img = element("img");
    			t13 = space();
    			h21 = element("h2");
    			h21.textContent = "Search by States/ City / Cities";
    			t15 = space();
    			form = element("form");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "List of cities (comma-separated, e.g. indore, jamnagar)";
    			t17 = space();
    			br3 = element("br");
    			t18 = space();
    			input0 = element("input");
    			t19 = space();
    			div3 = element("div");
    			t20 = text("Also search for:\n\n          ");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t21 = space();
    			div2 = element("div");
    			label1 = element("label");
    			label1.textContent = "Other:";
    			t23 = space();
    			input1 = element("input");
    			t24 = space();
    			div5 = element("div");
    			t25 = text("Tweets should ");
    			strong2 = element("strong");
    			strong2.textContent = "NOT";
    			t27 = text(" have these words:\n\n          ");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t28 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Other:";
    			t30 = space();
    			input2 = element("input");
    			t31 = space();
    			div6 = element("div");
    			input3 = element("input");
    			t32 = space();
    			label3 = element("label");
    			label3.textContent = "Show Tweets near me";
    			t34 = space();
    			div7 = element("div");
    			input4 = element("input");
    			t35 = space();
    			label4 = element("label");
    			t36 = text("Show verified tweets only\n            ");
    			br4 = element("br");
    			t37 = space();
    			strong3 = element("strong");
    			strong3.textContent = "Uncheck this for smaller cities";
    			t39 = space();
    			br5 = element("br");
    			t40 = text("\n            (Tweet should contain \"verified\")");
    			t41 = space();
    			div8 = element("div");
    			input5 = element("input");
    			t42 = space();
    			label5 = element("label");
    			t43 = text("Exclude unverified tweets\n            ");
    			br6 = element("br");
    			t44 = text("\n            (Tweet should not contain \"not verified\" and \"unverified\")");
    			t45 = space();
    			div9 = element("div");
    			button = element("button");
    			button.textContent = "Generate Links";
    			t47 = space();
    			if (if_block) if_block.c();
    			t48 = space();
    			div11 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Quick Links";
    			t50 = space();
    			ol1 = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t51 = space();
    			h3 = element("h3");
    			h3.textContent = "Scroll down to search for more cities and keywords";
    			t53 = space();
    			div12 = element("div");
    			h23 = element("h2");
    			h23.textContent = "Other Resources";
    			t55 = space();
    			ul0 = element("ul");
    			li3 = element("li");
    			a0 = element("a");
    			t56 = text("Check out - Lucknow Covid Resource Spreadsheet ");
    			br7 = element("br");
    			br8 = element("br");
    			t57 = text("(For Testing, Beds, Meds , Oxygen, Plasma, Ambulance, Hospital, Food etc).");
    			t58 = space();
    			ul1 = element("ul");
    			li4 = element("li");
    			a1 = element("a");
    			a1.textContent = "covidfacts.in";
    			t60 = space();
    			div13 = element("div");
    			h24 = element("h2");
    			h24.textContent = "Instagram Accounts sharing sources of Resources";
    			t62 = space();
    			ul2 = element("ul");
    			li5 = element("li");
    			a2 = element("a");
    			t63 = text("Check out - Lucknow Covid Resource Spreadsheet ");
    			br9 = element("br");
    			br10 = element("br");
    			t64 = text("(For Testing, Beds, Meds , Oxygen, Plasma, Ambulance, Hospital, Food etc).");
    			t65 = space();
    			ul3 = element("ul");
    			li6 = element("li");
    			a3 = element("a");
    			a3.textContent = "covidfacts.in";
    			t67 = space();
    			div14 = element("div");
    			h25 = element("h2");
    			h25.textContent = "[VOLUNTARY] Places you can Donate to";
    			t69 = space();
    			ul4 = element("ul");
    			li7 = element("li");
    			a4 = element("a");
    			a4.textContent = "Hemkunt Foundation";
    			t71 = text(" has been helping out with Oxygen Cylinders. 80G donation receipts available.");
    			t72 = space();
    			div19 = element("div");
    			div16 = element("div");
    			a5 = element("a");
    			a5.textContent = "Source code";
    			t74 = space();
    			div17 = element("div");
    			t75 = text("Made by ");
    			a6 = element("a");
    			a6.textContent = "Umang";
    			t77 = text(" with ideas from a lot of folks on the Internet");
    			t78 = space();
    			div18 = element("div");
    			t79 = text("Modified for Lucknow by ");
    			a7 = element("a");
    			a7.textContent = "SDS";
    			attr_dev(h1, "class", "svelte-ykqlu7");
    			add_location(h1, file, 325, 1, 5872);
    			attr_dev(br0, "class", "svelte-ykqlu7");
    			add_location(br0, file, 326, 97, 6011);
    			attr_dev(br1, "class", "svelte-ykqlu7");
    			add_location(br1, file, 326, 102, 6016);
    			attr_dev(strong0, "class", "svelte-ykqlu7");
    			add_location(strong0, file, 326, 107, 6021);
    			attr_dev(p, "class", "svelte-ykqlu7");
    			add_location(p, file, 326, 2, 5916);
    			attr_dev(h20, "class", "svelte-ykqlu7");
    			add_location(h20, file, 330, 8, 6157);
    			attr_dev(strong1, "class", "svelte-ykqlu7");
    			add_location(strong1, file, 332, 14, 6198);
    			attr_dev(li0, "class", "svelte-ykqlu7");
    			add_location(li0, file, 332, 10, 6194);
    			attr_dev(li1, "class", "svelte-ykqlu7");
    			add_location(li1, file, 333, 10, 6310);
    			attr_dev(br2, "class", "svelte-ykqlu7");
    			add_location(br2, file, 336, 12, 6441);
    			if (img.src !== (img_src_value = "sort-click-here.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-ykqlu7");
    			add_location(img, file, 337, 12, 6460);
    			attr_dev(li2, "class", "svelte-ykqlu7");
    			add_location(li2, file, 334, 10, 6364);
    			attr_dev(ol0, "class", "svelte-ykqlu7");
    			add_location(ol0, file, 331, 8, 6179);
    			attr_dev(div0, "id", "tips");
    			attr_dev(div0, "class", "svelte-ykqlu7");
    			add_location(div0, file, 329, 6, 6133);
    			attr_dev(h21, "class", "svelte-ykqlu7");
    			add_location(h21, file, 342, 6, 6551);
    			attr_dev(label0, "for", "cities");
    			attr_dev(label0, "class", "svelte-ykqlu7");
    			add_location(label0, file, 345, 10, 6665);
    			attr_dev(br3, "class", "svelte-ykqlu7");
    			add_location(br3, file, 346, 10, 6759);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "cities");
    			attr_dev(input0, "class", "svelte-ykqlu7");
    			add_location(input0, file, 347, 10, 6776);
    			attr_dev(div1, "class", "svelte-ykqlu7");
    			add_location(div1, file, 344, 8, 6649);
    			attr_dev(label1, "for", "alsoSearchFor-other");
    			attr_dev(label1, "class", "svelte-ykqlu7");
    			add_location(label1, file, 361, 12, 7230);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "alsoSearchFor-other");
    			attr_dev(input1, "class", "svelte-ykqlu7");
    			add_location(input1, file, 362, 12, 7290);
    			attr_dev(div2, "class", "svelte-ykqlu7");
    			add_location(div2, file, 360, 10, 7212);
    			attr_dev(div3, "class", "svelte-ykqlu7");
    			add_location(div3, file, 350, 8, 6861);
    			attr_dev(strong2, "class", "svelte-ykqlu7");
    			add_location(strong2, file, 368, 24, 7448);
    			attr_dev(label2, "for", "excludeKeywords-other");
    			attr_dev(label2, "class", "svelte-ykqlu7");
    			add_location(label2, file, 378, 12, 7820);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "id", "excludeKeywords-other");
    			attr_dev(input2, "class", "svelte-ykqlu7");
    			add_location(input2, file, 379, 12, 7882);
    			attr_dev(div4, "class", "svelte-ykqlu7");
    			add_location(div4, file, 377, 10, 7802);
    			attr_dev(div5, "class", "svelte-ykqlu7");
    			add_location(div5, file, 367, 8, 7418);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "id", "nearMe");
    			attr_dev(input3, "class", "svelte-ykqlu7");
    			add_location(input3, file, 384, 10, 8030);
    			attr_dev(label3, "for", "nearMe");
    			attr_dev(label3, "class", "svelte-ykqlu7");
    			add_location(label3, file, 385, 10, 8111);
    			attr_dev(div6, "class", "svelte-ykqlu7");
    			add_location(div6, file, 383, 8, 8014);
    			attr_dev(input4, "type", "checkbox");
    			attr_dev(input4, "id", "verifiedOnly");
    			attr_dev(input4, "class", "svelte-ykqlu7");
    			add_location(input4, file, 389, 10, 8199);
    			attr_dev(br4, "class", "svelte-ykqlu7");
    			add_location(br4, file, 392, 12, 8369);
    			attr_dev(strong3, "class", "svelte-ykqlu7");
    			add_location(strong3, file, 393, 12, 8388);
    			attr_dev(br5, "class", "svelte-ykqlu7");
    			add_location(br5, file, 394, 12, 8449);
    			attr_dev(label4, "for", "verifiedOnly");
    			attr_dev(label4, "class", "svelte-ykqlu7");
    			add_location(label4, file, 390, 10, 8292);
    			attr_dev(div7, "class", "svelte-ykqlu7");
    			add_location(div7, file, 388, 8, 8183);
    			attr_dev(input5, "type", "checkbox");
    			attr_dev(input5, "id", "excludeUnverified");
    			attr_dev(input5, "class", "svelte-ykqlu7");
    			add_location(input5, file, 400, 10, 8561);
    			attr_dev(br6, "class", "svelte-ykqlu7");
    			add_location(br6, file, 403, 12, 8746);
    			attr_dev(label5, "for", "excludeUnverified");
    			attr_dev(label5, "class", "svelte-ykqlu7");
    			add_location(label5, file, 401, 10, 8664);
    			attr_dev(div8, "class", "svelte-ykqlu7");
    			add_location(div8, file, 399, 8, 8545);
    			attr_dev(button, "class", "svelte-ykqlu7");
    			add_location(button, file, 409, 10, 8883);
    			attr_dev(div9, "class", "svelte-ykqlu7");
    			add_location(div9, file, 408, 8, 8867);
    			attr_dev(form, "class", "svelte-ykqlu7");
    			add_location(form, file, 343, 6, 6598);
    			attr_dev(div10, "id", "main-content");
    			attr_dev(div10, "class", "svelte-ykqlu7");
    			add_location(div10, file, 328, 4, 6103);
    			attr_dev(h22, "class", "svelte-ykqlu7");
    			add_location(h22, file, 426, 6, 9357);
    			attr_dev(ol1, "class", "list-split-on-mobile svelte-ykqlu7");
    			add_location(ol1, file, 428, 6, 9385);
    			attr_dev(h3, "class", "only-mobile highlight-red svelte-ykqlu7");
    			add_location(h3, file, 434, 6, 9617);
    			attr_dev(div11, "id", "quick-links");
    			attr_dev(div11, "class", "svelte-ykqlu7");
    			add_location(div11, file, 425, 4, 9328);
    			attr_dev(h23, "class", "svelte-ykqlu7");
    			add_location(h23, file, 437, 6, 9759);
    			attr_dev(br7, "class", "svelte-ykqlu7");
    			add_location(br7, file, 439, 206, 10001);
    			attr_dev(br8, "class", "svelte-ykqlu7");
    			add_location(br8, file, 439, 211, 10006);
    			attr_dev(a0, "href", "https://docs.google.com/spreadsheets/d/13my6gupVkHWMdNuz95aXQpWH3FD-deTV9KSLjoHntpg/edit#gid=0");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "rel", "noopener noreferrer");
    			attr_dev(a0, "class", "svelte-ykqlu7");
    			add_location(a0, file, 439, 12, 9807);
    			attr_dev(li3, "class", "svelte-ykqlu7");
    			add_location(li3, file, 439, 8, 9803);
    			attr_dev(ul0, "class", "svelte-ykqlu7");
    			add_location(ul0, file, 438, 6, 9790);
    			attr_dev(a1, "href", "https://covidfacts.in/");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "rel", "noopener noreferrer");
    			attr_dev(a1, "class", "svelte-ykqlu7");
    			add_location(a1, file, 442, 12, 10132);
    			attr_dev(li4, "class", "svelte-ykqlu7");
    			add_location(li4, file, 442, 8, 10128);
    			attr_dev(ul1, "class", "svelte-ykqlu7");
    			add_location(ul1, file, 441, 6, 10115);
    			attr_dev(div12, "id", "other-resources");
    			attr_dev(div12, "class", "svelte-ykqlu7");
    			add_location(div12, file, 436, 4, 9726);
    			attr_dev(h24, "class", "svelte-ykqlu7");
    			add_location(h24, file, 447, 6, 10291);
    			attr_dev(br9, "class", "svelte-ykqlu7");
    			add_location(br9, file, 449, 206, 10565);
    			attr_dev(br10, "class", "svelte-ykqlu7");
    			add_location(br10, file, 449, 211, 10570);
    			attr_dev(a2, "href", "https://docs.google.com/spreadsheets/d/13my6gupVkHWMdNuz95aXQpWH3FD-deTV9KSLjoHntpg/edit#gid=0");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "rel", "noopener noreferrer");
    			attr_dev(a2, "class", "svelte-ykqlu7");
    			add_location(a2, file, 449, 12, 10371);
    			attr_dev(li5, "class", "svelte-ykqlu7");
    			add_location(li5, file, 449, 8, 10367);
    			attr_dev(ul2, "class", "svelte-ykqlu7");
    			add_location(ul2, file, 448, 6, 10354);
    			attr_dev(a3, "href", "https://covidfacts.in/");
    			attr_dev(a3, "target", "_blank");
    			attr_dev(a3, "rel", "noopener noreferrer");
    			attr_dev(a3, "class", "svelte-ykqlu7");
    			add_location(a3, file, 452, 12, 10696);
    			attr_dev(li6, "class", "svelte-ykqlu7");
    			add_location(li6, file, 452, 8, 10692);
    			attr_dev(ul3, "class", "svelte-ykqlu7");
    			add_location(ul3, file, 451, 6, 10679);
    			attr_dev(div13, "id", "other-resources");
    			attr_dev(div13, "class", "svelte-ykqlu7");
    			add_location(div13, file, 446, 4, 10258);
    			attr_dev(h25, "class", "svelte-ykqlu7");
    			add_location(h25, file, 457, 6, 10846);
    			attr_dev(a4, "href", "https://hemkuntfoundation.com/donate-now/");
    			attr_dev(a4, "target", "_blank");
    			attr_dev(a4, "rel", "noopener noreferrer");
    			attr_dev(a4, "class", "svelte-ykqlu7");
    			add_location(a4, file, 459, 12, 10915);
    			attr_dev(li7, "class", "svelte-ykqlu7");
    			add_location(li7, file, 459, 8, 10911);
    			attr_dev(ul4, "class", "svelte-ykqlu7");
    			add_location(ul4, file, 458, 6, 10898);
    			attr_dev(div14, "id", "donate");
    			attr_dev(div14, "class", "svelte-ykqlu7");
    			add_location(div14, file, 456, 4, 10822);
    			attr_dev(div15, "class", "split svelte-ykqlu7");
    			add_location(div15, file, 327, 2, 6079);
    			attr_dev(a5, "href", "https://github.com/umanghome/twitter-search-covid19");
    			attr_dev(a5, "target", "_blank");
    			attr_dev(a5, "rel", "noopener noreferrer");
    			attr_dev(a5, "class", "svelte-ykqlu7");
    			add_location(a5, file, 465, 9, 11181);
    			attr_dev(div16, "class", "svelte-ykqlu7");
    			add_location(div16, file, 465, 4, 11176);
    			attr_dev(a6, "href", "https://twitter.com/umanghome");
    			attr_dev(a6, "target", "_blank");
    			attr_dev(a6, "rel", "noopener noreferrer");
    			attr_dev(a6, "class", "svelte-ykqlu7");
    			add_location(a6, file, 466, 17, 11324);
    			attr_dev(div17, "class", "svelte-ykqlu7");
    			add_location(div17, file, 466, 4, 11311);
    			attr_dev(a7, "href", "https://www.google.com/search?q=shivamdshon");
    			attr_dev(a7, "target", "_blank");
    			attr_dev(a7, "rel", "noopener noreferrer");
    			attr_dev(a7, "class", "svelte-ykqlu7");
    			add_location(a7, file, 467, 33, 11502);
    			attr_dev(div18, "class", "svelte-ykqlu7");
    			add_location(div18, file, 467, 4, 11473);
    			attr_dev(div19, "class", "feedback svelte-ykqlu7");
    			add_location(div19, file, 464, 2, 11149);
    			attr_dev(main, "class", "svelte-ykqlu7");
    			add_location(main, file, 324, 0, 5864);
    			attr_dev(body, "class", "svelte-ykqlu7");
    			add_location(body, file, 323, 0, 5857);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, body, anchor);
    			append_dev(body, main);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, br1);
    			append_dev(p, strong0);
    			append_dev(main, t4);
    			append_dev(main, div15);
    			append_dev(div15, div10);
    			append_dev(div10, div0);
    			append_dev(div0, h20);
    			append_dev(div0, t6);
    			append_dev(div0, ol0);
    			append_dev(ol0, li0);
    			append_dev(li0, strong1);
    			append_dev(ol0, t8);
    			append_dev(ol0, li1);
    			append_dev(ol0, t10);
    			append_dev(ol0, li2);
    			append_dev(li2, t11);
    			append_dev(li2, br2);
    			append_dev(li2, t12);
    			append_dev(li2, img);
    			append_dev(div10, t13);
    			append_dev(div10, h21);
    			append_dev(div10, t15);
    			append_dev(div10, form);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t17);
    			append_dev(div1, br3);
    			append_dev(div1, t18);
    			append_dev(div1, input0);
    			set_input_value(input0, /*inputs*/ ctx[0].cities);
    			append_dev(form, t19);
    			append_dev(form, div3);
    			append_dev(div3, t20);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div3, null);
    			}

    			append_dev(div3, t21);
    			append_dev(div3, div2);
    			append_dev(div2, label1);
    			append_dev(div2, t23);
    			append_dev(div2, input1);
    			set_input_value(input1, /*inputs*/ ctx[0].otherAlsoSearchFor);
    			append_dev(form, t24);
    			append_dev(form, div5);
    			append_dev(div5, t25);
    			append_dev(div5, strong2);
    			append_dev(div5, t27);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div5, null);
    			}

    			append_dev(div5, t28);
    			append_dev(div5, div4);
    			append_dev(div4, label2);
    			append_dev(div4, t30);
    			append_dev(div4, input2);
    			set_input_value(input2, /*inputs*/ ctx[0].otherExcludedKeywords);
    			append_dev(form, t31);
    			append_dev(form, div6);
    			append_dev(div6, input3);
    			input3.checked = /*checkboxes*/ ctx[1].nearMe;
    			append_dev(div6, t32);
    			append_dev(div6, label3);
    			append_dev(form, t34);
    			append_dev(form, div7);
    			append_dev(div7, input4);
    			input4.checked = /*checkboxes*/ ctx[1].verifiedOnly;
    			append_dev(div7, t35);
    			append_dev(div7, label4);
    			append_dev(label4, t36);
    			append_dev(label4, br4);
    			append_dev(label4, t37);
    			append_dev(label4, strong3);
    			append_dev(label4, t39);
    			append_dev(label4, br5);
    			append_dev(label4, t40);
    			append_dev(form, t41);
    			append_dev(form, div8);
    			append_dev(div8, input5);
    			input5.checked = /*checkboxes*/ ctx[1].excludeUnverified;
    			append_dev(div8, t42);
    			append_dev(div8, label5);
    			append_dev(label5, t43);
    			append_dev(label5, br6);
    			append_dev(label5, t44);
    			append_dev(form, t45);
    			append_dev(form, div9);
    			append_dev(div9, button);
    			append_dev(div10, t47);
    			if (if_block) if_block.m(div10, null);
    			append_dev(div15, t48);
    			append_dev(div15, div11);
    			append_dev(div11, h22);
    			append_dev(div11, t50);
    			append_dev(div11, ol1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol1, null);
    			}

    			append_dev(div11, t51);
    			append_dev(div11, h3);
    			append_dev(div15, t53);
    			append_dev(div15, div12);
    			append_dev(div12, h23);
    			append_dev(div12, t55);
    			append_dev(div12, ul0);
    			append_dev(ul0, li3);
    			append_dev(li3, a0);
    			append_dev(a0, t56);
    			append_dev(a0, br7);
    			append_dev(a0, br8);
    			append_dev(a0, t57);
    			append_dev(div12, t58);
    			append_dev(div12, ul1);
    			append_dev(ul1, li4);
    			append_dev(li4, a1);
    			append_dev(div15, t60);
    			append_dev(div15, div13);
    			append_dev(div13, h24);
    			append_dev(div13, t62);
    			append_dev(div13, ul2);
    			append_dev(ul2, li5);
    			append_dev(li5, a2);
    			append_dev(a2, t63);
    			append_dev(a2, br9);
    			append_dev(a2, br10);
    			append_dev(a2, t64);
    			append_dev(div13, t65);
    			append_dev(div13, ul3);
    			append_dev(ul3, li6);
    			append_dev(li6, a3);
    			append_dev(div15, t67);
    			append_dev(div15, div14);
    			append_dev(div14, h25);
    			append_dev(div14, t69);
    			append_dev(div14, ul4);
    			append_dev(ul4, li7);
    			append_dev(li7, a4);
    			append_dev(li7, t71);
    			append_dev(main, t72);
    			append_dev(main, div19);
    			append_dev(div19, div16);
    			append_dev(div16, a5);
    			append_dev(div19, t74);
    			append_dev(div19, div17);
    			append_dev(div17, t75);
    			append_dev(div17, a6);
    			append_dev(div17, t77);
    			append_dev(div19, t78);
    			append_dev(div19, div18);
    			append_dev(div18, t79);
    			append_dev(div18, a7);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[12]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[13]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[14]),
    					listen_dev(input5, "change", /*input5_change_handler*/ ctx[15]),
    					listen_dev(form, "submit", prevent_default(/*generate*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*inputs*/ 1 && input0.value !== /*inputs*/ ctx[0].cities) {
    				set_input_value(input0, /*inputs*/ ctx[0].cities);
    			}

    			if (dirty & /*Object, alsoSearchFor, capitalCase*/ 4) {
    				each_value_3 = Object.keys(/*alsoSearchFor*/ ctx[2]);
    				validate_each_argument(each_value_3);
    				validate_each_keys(ctx, each_value_3, get_each_context_3, get_key);
    				each_blocks_2 = update_keyed_each(each_blocks_2, dirty, get_key, 1, ctx, each_value_3, each0_lookup, div3, destroy_block, create_each_block_3, t21, get_each_context_3);
    			}

    			if (dirty & /*inputs*/ 1 && input1.value !== /*inputs*/ ctx[0].otherAlsoSearchFor) {
    				set_input_value(input1, /*inputs*/ ctx[0].otherAlsoSearchFor);
    			}

    			if (dirty & /*Object, excludeKeywords*/ 8) {
    				each_value_2 = Object.keys(/*excludeKeywords*/ ctx[3]);
    				validate_each_argument(each_value_2);
    				validate_each_keys(ctx, each_value_2, get_each_context_2, get_key_1);
    				each_blocks_1 = update_keyed_each(each_blocks_1, dirty, get_key_1, 1, ctx, each_value_2, each1_lookup, div5, destroy_block, create_each_block_2, t28, get_each_context_2);
    			}

    			if (dirty & /*inputs*/ 1 && input2.value !== /*inputs*/ ctx[0].otherExcludedKeywords) {
    				set_input_value(input2, /*inputs*/ ctx[0].otherExcludedKeywords);
    			}

    			if (dirty & /*checkboxes*/ 2) {
    				input3.checked = /*checkboxes*/ ctx[1].nearMe;
    			}

    			if (dirty & /*checkboxes*/ 2) {
    				input4.checked = /*checkboxes*/ ctx[1].verifiedOnly;
    			}

    			if (dirty & /*checkboxes*/ 2) {
    				input5.checked = /*checkboxes*/ ctx[1].excludeUnverified;
    			}

    			if (/*links*/ ctx[4].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div10, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*popularCityLinks, capitalCase*/ 32) {
    				each_value = /*popularCityLinks*/ ctx[5];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key_2);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key_2, 1, ctx, each_value, each2_lookup, ol1, destroy_block, create_each_block, null, get_each_context);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].d();
    			}

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].d();
    			}

    			if (if_block) if_block.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	const inputs = {
    		cities: "",
    		otherAlsoSearchFor: "",
    		otherExcludedKeywords: ""
    	};

    	const checkboxes = {
    		nearMe: false,
    		verifiedOnly: true,
    		excludeUnverified: false
    	};

    	const alsoSearchFor = {
    		beds: {
    			keywords: ["bed", "beds", "oxygen beds", "oxygenbeds"],
    			checked: true
    		},
    		Doctors: {
    			keywords: ["doctor", "dr"],
    			checked: true
    		},
    		ICU: { keywords: ["icu"], checked: true },
    		oxygen: { keywords: ["oxygen"], checked: true },
    		ventilator: {
    			keywords: ["ventilator", "ventilators"],
    			checked: true
    		},
    		fabiflu: { keywords: ["fabiflu"], checked: true },
    		remdesivir: { keywords: ["remdesivir"], checked: false },
    		favipiravir: {
    			keywords: ["favipiravir"],
    			checked: false
    		},
    		tocilizumab: {
    			keywords: ["tocilizumab"],
    			checked: false
    		},
    		plasma: {
    			keywords: ["plasma", "plazma"],
    			checked: false
    		},
    		tiffin: {
    			keywords: ["tiffin", "lunch", "dinner"],
    			checked: false
    		}
    	};

    	const excludeKeywords = {
    		needed: { keywords: ["needed"], checked: true },
    		required: { keywords: ["required"], checked: true }
    	};

    	let links = LocalStorage.getItem(STORAGE_KEY.generated_links, []);
    	let popularCityLinks = [];

    	function generatePopularCityLinks() {
    		$$invalidate(5, popularCityLinks = POPULAR_CITIES.map(city => {
    			return { city, href: generateLinkForCity(city) };
    		}));
    	}

    	function getAlsoSearchForString() {
    		const keywords = Object.keys(alsoSearchFor).reduce(
    			(keywordsSoFar, item) => {
    				if (alsoSearchFor[item].checked) {
    					return keywordsSoFar.concat(alsoSearchFor[item].keywords);
    				} else {
    					return keywordsSoFar;
    				}
    			},
    			[]
    		);

    		if (inputs.otherAlsoSearchFor) {
    			keywords.push(inputs.otherAlsoSearchFor);
    		}

    		if (keywords.length > 0) {
    			return `(${keywords.join(" OR ")})`;
    		} else {
    			return "";
    		}
    	}

    	function getExcludedKeywordsString() {
    		const keywords = Object.keys(excludeKeywords).reduce(
    			(keywordsSoFar, item) => {
    				if (excludeKeywords[item].checked) {
    					return keywordsSoFar.concat(excludeKeywords[item].keywords);
    				} else {
    					return keywordsSoFar;
    				}
    			},
    			[]
    		);

    		if (inputs.otherExcludedKeywords) {
    			keywords.push(inputs.otherExcludedKeywords);
    		}

    		return keywords.map(keyword => `-"${keyword}"`).join(" ");
    	}

    	function generateLinkForCity(city) {
    		const base = `https://twitter.com/search`;
    		const params = new URLSearchParams();

    		const query = [
    			checkboxes.verifiedOnly && "verified",
    			city.trim(),
    			getAlsoSearchForString(),
    			checkboxes.excludeUnverified && "-\"not verified\"",
    			checkboxes.excludeUnverified && "-\"unverified\"",
    			getExcludedKeywordsString()
    		].filter(Boolean).join(" ");

    		params.set("q", query);
    		params.set("f", "live");

    		if (checkboxes.nearMe) {
    			params.set("lf", "on");
    		}

    		const link = `${base}?${params.toString()}`;
    		return link;
    	}

    	function generate() {
    		if (!inputs.cities) {
    			alert("Please enter city name(s)");
    			return;
    		}

    		const cities = inputs.cities.split(",").map(city => city.trim()).filter(Boolean);

    		$$invalidate(4, links = cities.map(city => {
    			return { city, href: generateLinkForCity(city) };
    		}));

    		tick().then(() => {
    			const firstItem = document.querySelector("#city-links li");

    			if (firstItem) {
    				firstItem.scrollIntoView();
    				firstItem.focus();
    				alert("Please check the Links section");
    			}

    			LocalStorage.setItem(STORAGE_KEY.generated_links, links);
    		});
    	}

    	function clearSavedLinks() {
    		$$invalidate(4, links = []);
    		LocalStorage.removeItem(STORAGE_KEY.generated_links);
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		inputs.cities = this.value;
    		$$invalidate(0, inputs);
    	}

    	function input_change_handler(item) {
    		alsoSearchFor[item].checked = this.checked;
    		$$invalidate(2, alsoSearchFor);
    	}

    	function input1_input_handler() {
    		inputs.otherAlsoSearchFor = this.value;
    		$$invalidate(0, inputs);
    	}

    	function input_change_handler_1(item) {
    		excludeKeywords[item].checked = this.checked;
    		$$invalidate(3, excludeKeywords);
    	}

    	function input2_input_handler() {
    		inputs.otherExcludedKeywords = this.value;
    		$$invalidate(0, inputs);
    	}

    	function input3_change_handler() {
    		checkboxes.nearMe = this.checked;
    		$$invalidate(1, checkboxes);
    	}

    	function input4_change_handler() {
    		checkboxes.verifiedOnly = this.checked;
    		$$invalidate(1, checkboxes);
    	}

    	function input5_change_handler() {
    		checkboxes.excludeUnverified = this.checked;
    		$$invalidate(1, checkboxes);
    	}

    	$$self.$capture_state = () => ({
    		tick,
    		POPULAR_CITIES,
    		STORAGE_KEY,
    		LocalStorage,
    		capitalCase,
    		inputs,
    		checkboxes,
    		alsoSearchFor,
    		excludeKeywords,
    		links,
    		popularCityLinks,
    		generatePopularCityLinks,
    		getAlsoSearchForString,
    		getExcludedKeywordsString,
    		generateLinkForCity,
    		generate,
    		clearSavedLinks
    	});

    	$$self.$inject_state = $$props => {
    		if ("links" in $$props) $$invalidate(4, links = $$props.links);
    		if ("popularCityLinks" in $$props) $$invalidate(5, popularCityLinks = $$props.popularCityLinks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*alsoSearchFor, inputs, checkboxes*/ 7) {
    			 (generatePopularCityLinks());
    		}
    	};

    	return [
    		inputs,
    		checkboxes,
    		alsoSearchFor,
    		excludeKeywords,
    		links,
    		popularCityLinks,
    		generate,
    		clearSavedLinks,
    		input0_input_handler,
    		input_change_handler,
    		input1_input_handler,
    		input_change_handler_1,
    		input2_input_handler,
    		input3_change_handler,
    		input4_change_handler,
    		input5_change_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

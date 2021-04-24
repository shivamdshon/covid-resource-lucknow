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
    			add_location(input, file, 355, 14, 7057);
    			attr_dev(label, "for", label_for_value = `alsoSearchFor-${/*item*/ ctx[25]}`);
    			attr_dev(label, "class", "svelte-ykqlu7");
    			add_location(label, file, 356, 14, 7169);
    			attr_dev(div, "class", "svelte-ykqlu7");
    			add_location(div, file, 354, 12, 7037);
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
    			add_location(input, file, 372, 14, 7652);
    			attr_dev(label, "for", label_for_value = `excludeKeywords-${/*item*/ ctx[25]}`);
    			attr_dev(label, "class", "svelte-ykqlu7");
    			add_location(label, file, 373, 14, 7768);
    			attr_dev(div, "class", "svelte-ykqlu7");
    			add_location(div, file, 371, 12, 7632);
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
    			add_location(h2, file, 414, 8, 9052);
    			attr_dev(ol, "id", "city-links");
    			attr_dev(ol, "class", "svelte-ykqlu7");
    			add_location(ol, file, 416, 8, 9091);
    			attr_dev(button, "class", "svelte-ykqlu7");
    			add_location(button, file, 422, 8, 9309);
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
    			add_location(a, file, 418, 16, 9172);
    			attr_dev(li, "class", "svelte-ykqlu7");
    			add_location(li, file, 418, 12, 9168);
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
    			add_location(a, file, 430, 14, 9556);
    			attr_dev(li, "class", "svelte-ykqlu7");
    			add_location(li, file, 430, 10, 9552);
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
    	let meta;
    	let t0;
    	let body;
    	let main;
    	let h1;
    	let t2;
    	let p;
    	let t3;
    	let br0;
    	let br1;
    	let strong0;
    	let t5;
    	let div15;
    	let div10;
    	let div0;
    	let h20;
    	let t7;
    	let ol0;
    	let li0;
    	let strong1;
    	let t9;
    	let li1;
    	let t11;
    	let li2;
    	let t12;
    	let br2;
    	let t13;
    	let img;
    	let img_src_value;
    	let t14;
    	let h21;
    	let t16;
    	let form;
    	let div1;
    	let label0;
    	let t18;
    	let br3;
    	let t19;
    	let input0;
    	let t20;
    	let div3;
    	let t21;
    	let each_blocks_2 = [];
    	let each0_lookup = new Map();
    	let t22;
    	let div2;
    	let label1;
    	let t24;
    	let input1;
    	let t25;
    	let div5;
    	let t26;
    	let strong2;
    	let t28;
    	let each_blocks_1 = [];
    	let each1_lookup = new Map();
    	let t29;
    	let div4;
    	let label2;
    	let t31;
    	let input2;
    	let t32;
    	let div6;
    	let input3;
    	let t33;
    	let label3;
    	let t35;
    	let div7;
    	let input4;
    	let t36;
    	let label4;
    	let t37;
    	let br4;
    	let t38;
    	let strong3;
    	let t40;
    	let br5;
    	let t41;
    	let t42;
    	let div8;
    	let input5;
    	let t43;
    	let label5;
    	let t44;
    	let br6;
    	let t45;
    	let t46;
    	let div9;
    	let button;
    	let t48;
    	let t49;
    	let div11;
    	let h22;
    	let t51;
    	let ol1;
    	let each_blocks = [];
    	let each2_lookup = new Map();
    	let t52;
    	let h3;
    	let t54;
    	let div12;
    	let h23;
    	let t56;
    	let ul0;
    	let li3;
    	let a0;
    	let t57;
    	let br7;
    	let br8;
    	let t58;
    	let t59;
    	let ul1;
    	let li4;
    	let a1;
    	let t61;
    	let div13;
    	let h24;
    	let t63;
    	let ul2;
    	let li5;
    	let a2;
    	let t65;
    	let br9;
    	let br10;
    	let t66;
    	let br11;
    	let t67;
    	let t68;
    	let div14;
    	let h25;
    	let t70;
    	let ul3;
    	let li6;
    	let a3;
    	let t72;
    	let t73;
    	let div19;
    	let div16;
    	let a4;
    	let t75;
    	let div17;
    	let t76;
    	let a5;
    	let t78;
    	let t79;
    	let div18;
    	let t80;
    	let a6;
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
    			meta = element("meta");
    			t0 = space();
    			body = element("body");
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Lucknow - Covid Resources Finder";
    			t2 = space();
    			p = element("p");
    			t3 = text("This is a remastered & modified version for finding covid resources in all areas of Lucknow.");
    			br0 = element("br");
    			br1 = element("br");
    			strong0 = element("strong");
    			strong0.textContent = "Please note, I hold no copyrights.";
    			t5 = space();
    			div15 = element("div");
    			div10 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Tips";
    			t7 = space();
    			ol0 = element("ol");
    			li0 = element("li");
    			strong1 = element("strong");
    			strong1.textContent = "Do NOT make advanced payments unless you are 100% sure about their authenticity";
    			t9 = space();
    			li1 = element("li");
    			li1.textContent = "Check for replies under the tweets";
    			t11 = space();
    			li2 = element("li");
    			t12 = text("Make sure search results are sorted by \"Latest\"\n            ");
    			br2 = element("br");
    			t13 = space();
    			img = element("img");
    			t14 = space();
    			h21 = element("h2");
    			h21.textContent = "Search by States/ City / Cities";
    			t16 = space();
    			form = element("form");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "List of cities (comma-separated, e.g. indore, jamnagar)";
    			t18 = space();
    			br3 = element("br");
    			t19 = space();
    			input0 = element("input");
    			t20 = space();
    			div3 = element("div");
    			t21 = text("Also search for:\n\n          ");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t22 = space();
    			div2 = element("div");
    			label1 = element("label");
    			label1.textContent = "Other:";
    			t24 = space();
    			input1 = element("input");
    			t25 = space();
    			div5 = element("div");
    			t26 = text("Tweets should ");
    			strong2 = element("strong");
    			strong2.textContent = "NOT";
    			t28 = text(" have these words:\n\n          ");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t29 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Other:";
    			t31 = space();
    			input2 = element("input");
    			t32 = space();
    			div6 = element("div");
    			input3 = element("input");
    			t33 = space();
    			label3 = element("label");
    			label3.textContent = "Show Tweets near me";
    			t35 = space();
    			div7 = element("div");
    			input4 = element("input");
    			t36 = space();
    			label4 = element("label");
    			t37 = text("Show verified tweets only\n            ");
    			br4 = element("br");
    			t38 = space();
    			strong3 = element("strong");
    			strong3.textContent = "Uncheck this for smaller cities";
    			t40 = space();
    			br5 = element("br");
    			t41 = text("\n            (Tweet should contain \"verified\")");
    			t42 = space();
    			div8 = element("div");
    			input5 = element("input");
    			t43 = space();
    			label5 = element("label");
    			t44 = text("Exclude unverified tweets\n            ");
    			br6 = element("br");
    			t45 = text("\n            (Tweet should not contain \"not verified\" and \"unverified\")");
    			t46 = space();
    			div9 = element("div");
    			button = element("button");
    			button.textContent = "Generate Links";
    			t48 = space();
    			if (if_block) if_block.c();
    			t49 = space();
    			div11 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Quick Links";
    			t51 = space();
    			ol1 = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t52 = space();
    			h3 = element("h3");
    			h3.textContent = "Scroll down to search for more cities and keywords";
    			t54 = space();
    			div12 = element("div");
    			h23 = element("h2");
    			h23.textContent = "Other Resources";
    			t56 = space();
    			ul0 = element("ul");
    			li3 = element("li");
    			a0 = element("a");
    			t57 = text("Check out - Lucknow Covid Resource Spreadsheet ");
    			br7 = element("br");
    			br8 = element("br");
    			t58 = text("(For Testing, Beds, Meds , Oxygen, Plasma, Ambulance, Hospital, Food etc).");
    			t59 = space();
    			ul1 = element("ul");
    			li4 = element("li");
    			a1 = element("a");
    			a1.textContent = "covidfacts.in";
    			t61 = space();
    			div13 = element("div");
    			h24 = element("h2");
    			h24.textContent = "Telegram Group Chat For Sharing Resources (Lucknow)";
    			t63 = space();
    			ul2 = element("ul");
    			li5 = element("li");
    			a2 = element("a");
    			a2.textContent = "Click here - For Joining the Telegram group.";
    			t65 = space();
    			br9 = element("br");
    			br10 = element("br");
    			t66 = text("(Note: Please share only verified sources of resource in group. )");
    			br11 = element("br");
    			t67 = text("DO NOT MAKE ADVANCED PAYMENTS UNLESS YOU ARE 100% SURE ABOUT THEIR AUTHENTICITY. I hold no responsibility for your actions.");
    			t68 = space();
    			div14 = element("div");
    			h25 = element("h2");
    			h25.textContent = "[VOLUNTARY] Places you can Donate to";
    			t70 = space();
    			ul3 = element("ul");
    			li6 = element("li");
    			a3 = element("a");
    			a3.textContent = "Hemkunt Foundation";
    			t72 = text(" has been helping out with Oxygen Cylinders. 80G donation receipts available.");
    			t73 = space();
    			div19 = element("div");
    			div16 = element("div");
    			a4 = element("a");
    			a4.textContent = "Source code";
    			t75 = space();
    			div17 = element("div");
    			t76 = text("Made by ");
    			a5 = element("a");
    			a5.textContent = "Umang";
    			t78 = text(" with ideas from a lot of folks on the Internet");
    			t79 = space();
    			div18 = element("div");
    			t80 = text("Modified for Lucknow by ");
    			a6 = element("a");
    			a6.textContent = "SDS";
    			attr_dev(meta, "name", "viewport");
    			attr_dev(meta, "content", "width=device-width, initial-scale=1.0");
    			attr_dev(meta, "class", "svelte-ykqlu7");
    			add_location(meta, file, 187, 0, 4141);
    			attr_dev(h1, "class", "svelte-ykqlu7");
    			add_location(h1, file, 325, 1, 5942);
    			attr_dev(br0, "class", "svelte-ykqlu7");
    			add_location(br0, file, 326, 97, 6081);
    			attr_dev(br1, "class", "svelte-ykqlu7");
    			add_location(br1, file, 326, 102, 6086);
    			attr_dev(strong0, "class", "svelte-ykqlu7");
    			add_location(strong0, file, 326, 107, 6091);
    			attr_dev(p, "class", "svelte-ykqlu7");
    			add_location(p, file, 326, 2, 5986);
    			attr_dev(h20, "class", "svelte-ykqlu7");
    			add_location(h20, file, 330, 8, 6227);
    			attr_dev(strong1, "class", "svelte-ykqlu7");
    			add_location(strong1, file, 332, 14, 6268);
    			attr_dev(li0, "class", "svelte-ykqlu7");
    			add_location(li0, file, 332, 10, 6264);
    			attr_dev(li1, "class", "svelte-ykqlu7");
    			add_location(li1, file, 333, 10, 6380);
    			attr_dev(br2, "class", "svelte-ykqlu7");
    			add_location(br2, file, 336, 12, 6511);
    			if (img.src !== (img_src_value = "sort-click-here.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-ykqlu7");
    			add_location(img, file, 337, 12, 6530);
    			attr_dev(li2, "class", "svelte-ykqlu7");
    			add_location(li2, file, 334, 10, 6434);
    			attr_dev(ol0, "class", "svelte-ykqlu7");
    			add_location(ol0, file, 331, 8, 6249);
    			attr_dev(div0, "id", "tips");
    			attr_dev(div0, "class", "svelte-ykqlu7");
    			add_location(div0, file, 329, 6, 6203);
    			attr_dev(h21, "class", "svelte-ykqlu7");
    			add_location(h21, file, 342, 6, 6621);
    			attr_dev(label0, "for", "cities");
    			attr_dev(label0, "class", "svelte-ykqlu7");
    			add_location(label0, file, 345, 10, 6735);
    			attr_dev(br3, "class", "svelte-ykqlu7");
    			add_location(br3, file, 346, 10, 6829);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "cities");
    			attr_dev(input0, "class", "svelte-ykqlu7");
    			add_location(input0, file, 347, 10, 6846);
    			attr_dev(div1, "class", "svelte-ykqlu7");
    			add_location(div1, file, 344, 8, 6719);
    			attr_dev(label1, "for", "alsoSearchFor-other");
    			attr_dev(label1, "class", "svelte-ykqlu7");
    			add_location(label1, file, 361, 12, 7300);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "alsoSearchFor-other");
    			attr_dev(input1, "class", "svelte-ykqlu7");
    			add_location(input1, file, 362, 12, 7360);
    			attr_dev(div2, "class", "svelte-ykqlu7");
    			add_location(div2, file, 360, 10, 7282);
    			attr_dev(div3, "class", "svelte-ykqlu7");
    			add_location(div3, file, 350, 8, 6931);
    			attr_dev(strong2, "class", "svelte-ykqlu7");
    			add_location(strong2, file, 368, 24, 7518);
    			attr_dev(label2, "for", "excludeKeywords-other");
    			attr_dev(label2, "class", "svelte-ykqlu7");
    			add_location(label2, file, 378, 12, 7890);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "id", "excludeKeywords-other");
    			attr_dev(input2, "class", "svelte-ykqlu7");
    			add_location(input2, file, 379, 12, 7952);
    			attr_dev(div4, "class", "svelte-ykqlu7");
    			add_location(div4, file, 377, 10, 7872);
    			attr_dev(div5, "class", "svelte-ykqlu7");
    			add_location(div5, file, 367, 8, 7488);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "id", "nearMe");
    			attr_dev(input3, "class", "svelte-ykqlu7");
    			add_location(input3, file, 384, 10, 8100);
    			attr_dev(label3, "for", "nearMe");
    			attr_dev(label3, "class", "svelte-ykqlu7");
    			add_location(label3, file, 385, 10, 8181);
    			attr_dev(div6, "class", "svelte-ykqlu7");
    			add_location(div6, file, 383, 8, 8084);
    			attr_dev(input4, "type", "checkbox");
    			attr_dev(input4, "id", "verifiedOnly");
    			attr_dev(input4, "class", "svelte-ykqlu7");
    			add_location(input4, file, 389, 10, 8269);
    			attr_dev(br4, "class", "svelte-ykqlu7");
    			add_location(br4, file, 392, 12, 8439);
    			attr_dev(strong3, "class", "svelte-ykqlu7");
    			add_location(strong3, file, 393, 12, 8458);
    			attr_dev(br5, "class", "svelte-ykqlu7");
    			add_location(br5, file, 394, 12, 8519);
    			attr_dev(label4, "for", "verifiedOnly");
    			attr_dev(label4, "class", "svelte-ykqlu7");
    			add_location(label4, file, 390, 10, 8362);
    			attr_dev(div7, "class", "svelte-ykqlu7");
    			add_location(div7, file, 388, 8, 8253);
    			attr_dev(input5, "type", "checkbox");
    			attr_dev(input5, "id", "excludeUnverified");
    			attr_dev(input5, "class", "svelte-ykqlu7");
    			add_location(input5, file, 400, 10, 8631);
    			attr_dev(br6, "class", "svelte-ykqlu7");
    			add_location(br6, file, 403, 12, 8816);
    			attr_dev(label5, "for", "excludeUnverified");
    			attr_dev(label5, "class", "svelte-ykqlu7");
    			add_location(label5, file, 401, 10, 8734);
    			attr_dev(div8, "class", "svelte-ykqlu7");
    			add_location(div8, file, 399, 8, 8615);
    			attr_dev(button, "class", "svelte-ykqlu7");
    			add_location(button, file, 409, 10, 8953);
    			attr_dev(div9, "class", "svelte-ykqlu7");
    			add_location(div9, file, 408, 8, 8937);
    			attr_dev(form, "class", "svelte-ykqlu7");
    			add_location(form, file, 343, 6, 6668);
    			attr_dev(div10, "id", "main-content");
    			attr_dev(div10, "class", "svelte-ykqlu7");
    			add_location(div10, file, 328, 4, 6173);
    			attr_dev(h22, "class", "svelte-ykqlu7");
    			add_location(h22, file, 426, 6, 9427);
    			attr_dev(ol1, "class", "list-split-on-mobile svelte-ykqlu7");
    			add_location(ol1, file, 428, 6, 9455);
    			attr_dev(h3, "class", "only-mobile highlight-red svelte-ykqlu7");
    			add_location(h3, file, 434, 6, 9687);
    			attr_dev(div11, "id", "quick-links");
    			attr_dev(div11, "class", "svelte-ykqlu7");
    			add_location(div11, file, 425, 4, 9398);
    			attr_dev(h23, "class", "svelte-ykqlu7");
    			add_location(h23, file, 437, 6, 9829);
    			attr_dev(br7, "class", "svelte-ykqlu7");
    			add_location(br7, file, 439, 206, 10071);
    			attr_dev(br8, "class", "svelte-ykqlu7");
    			add_location(br8, file, 439, 211, 10076);
    			attr_dev(a0, "href", "https://docs.google.com/spreadsheets/d/13my6gupVkHWMdNuz95aXQpWH3FD-deTV9KSLjoHntpg/edit#gid=0");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "rel", "noopener noreferrer");
    			attr_dev(a0, "class", "svelte-ykqlu7");
    			add_location(a0, file, 439, 12, 9877);
    			attr_dev(li3, "class", "svelte-ykqlu7");
    			add_location(li3, file, 439, 8, 9873);
    			attr_dev(ul0, "class", "svelte-ykqlu7");
    			add_location(ul0, file, 438, 6, 9860);
    			attr_dev(a1, "href", "https://covidfacts.in/");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "rel", "noopener noreferrer");
    			attr_dev(a1, "class", "svelte-ykqlu7");
    			add_location(a1, file, 442, 12, 10202);
    			attr_dev(li4, "class", "svelte-ykqlu7");
    			add_location(li4, file, 442, 8, 10198);
    			attr_dev(ul1, "class", "svelte-ykqlu7");
    			add_location(ul1, file, 441, 6, 10185);
    			attr_dev(div12, "id", "other-resources");
    			attr_dev(div12, "class", "svelte-ykqlu7");
    			add_location(div12, file, 436, 4, 9796);
    			attr_dev(h24, "class", "svelte-ykqlu7");
    			add_location(h24, file, 447, 6, 10361);
    			attr_dev(a2, "href", "https://t.me/joinchat/c4g2zXSxhsM1ZjRl");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "rel", "noopener noreferrer");
    			attr_dev(a2, "class", "svelte-ykqlu7");
    			add_location(a2, file, 449, 12, 10445);
    			attr_dev(li5, "class", "svelte-ykqlu7");
    			add_location(li5, file, 449, 8, 10441);
    			attr_dev(br9, "class", "svelte-ykqlu7");
    			add_location(br9, file, 449, 158, 10591);
    			attr_dev(br10, "class", "svelte-ykqlu7");
    			add_location(br10, file, 449, 163, 10596);
    			attr_dev(br11, "class", "svelte-ykqlu7");
    			add_location(br11, file, 449, 234, 10667);
    			attr_dev(ul2, "class", "svelte-ykqlu7");
    			add_location(ul2, file, 448, 6, 10428);
    			attr_dev(div13, "id", "other-resources");
    			attr_dev(div13, "class", "svelte-ykqlu7");
    			add_location(div13, file, 446, 4, 10328);
    			attr_dev(h25, "class", "svelte-ykqlu7");
    			add_location(h25, file, 454, 6, 10848);
    			attr_dev(a3, "href", "https://hemkuntfoundation.com/donate-now/");
    			attr_dev(a3, "target", "_blank");
    			attr_dev(a3, "rel", "noopener noreferrer");
    			attr_dev(a3, "class", "svelte-ykqlu7");
    			add_location(a3, file, 456, 12, 10917);
    			attr_dev(li6, "class", "svelte-ykqlu7");
    			add_location(li6, file, 456, 8, 10913);
    			attr_dev(ul3, "class", "svelte-ykqlu7");
    			add_location(ul3, file, 455, 6, 10900);
    			attr_dev(div14, "id", "donate");
    			attr_dev(div14, "class", "svelte-ykqlu7");
    			add_location(div14, file, 453, 4, 10824);
    			attr_dev(div15, "class", "split svelte-ykqlu7");
    			add_location(div15, file, 327, 2, 6149);
    			attr_dev(a4, "href", "https://github.com/umanghome/twitter-search-covid19");
    			attr_dev(a4, "target", "_blank");
    			attr_dev(a4, "rel", "noopener noreferrer");
    			attr_dev(a4, "class", "svelte-ykqlu7");
    			add_location(a4, file, 462, 9, 11183);
    			attr_dev(div16, "class", "svelte-ykqlu7");
    			add_location(div16, file, 462, 4, 11178);
    			attr_dev(a5, "href", "https://twitter.com/umanghome");
    			attr_dev(a5, "target", "_blank");
    			attr_dev(a5, "rel", "noopener noreferrer");
    			attr_dev(a5, "class", "svelte-ykqlu7");
    			add_location(a5, file, 463, 17, 11326);
    			attr_dev(div17, "class", "svelte-ykqlu7");
    			add_location(div17, file, 463, 4, 11313);
    			attr_dev(a6, "href", "https://www.google.com/search?q=shivamdshon");
    			attr_dev(a6, "target", "_blank");
    			attr_dev(a6, "rel", "noopener noreferrer");
    			attr_dev(a6, "class", "svelte-ykqlu7");
    			add_location(a6, file, 464, 33, 11504);
    			attr_dev(div18, "class", "svelte-ykqlu7");
    			add_location(div18, file, 464, 4, 11475);
    			attr_dev(div19, "class", "feedback svelte-ykqlu7");
    			add_location(div19, file, 461, 2, 11151);
    			attr_dev(main, "class", "svelte-ykqlu7");
    			add_location(main, file, 324, 0, 5934);
    			attr_dev(body, "class", "svelte-ykqlu7");
    			add_location(body, file, 323, 0, 5927);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, meta, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, body, anchor);
    			append_dev(body, main);
    			append_dev(main, h1);
    			append_dev(main, t2);
    			append_dev(main, p);
    			append_dev(p, t3);
    			append_dev(p, br0);
    			append_dev(p, br1);
    			append_dev(p, strong0);
    			append_dev(main, t5);
    			append_dev(main, div15);
    			append_dev(div15, div10);
    			append_dev(div10, div0);
    			append_dev(div0, h20);
    			append_dev(div0, t7);
    			append_dev(div0, ol0);
    			append_dev(ol0, li0);
    			append_dev(li0, strong1);
    			append_dev(ol0, t9);
    			append_dev(ol0, li1);
    			append_dev(ol0, t11);
    			append_dev(ol0, li2);
    			append_dev(li2, t12);
    			append_dev(li2, br2);
    			append_dev(li2, t13);
    			append_dev(li2, img);
    			append_dev(div10, t14);
    			append_dev(div10, h21);
    			append_dev(div10, t16);
    			append_dev(div10, form);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t18);
    			append_dev(div1, br3);
    			append_dev(div1, t19);
    			append_dev(div1, input0);
    			set_input_value(input0, /*inputs*/ ctx[0].cities);
    			append_dev(form, t20);
    			append_dev(form, div3);
    			append_dev(div3, t21);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div3, null);
    			}

    			append_dev(div3, t22);
    			append_dev(div3, div2);
    			append_dev(div2, label1);
    			append_dev(div2, t24);
    			append_dev(div2, input1);
    			set_input_value(input1, /*inputs*/ ctx[0].otherAlsoSearchFor);
    			append_dev(form, t25);
    			append_dev(form, div5);
    			append_dev(div5, t26);
    			append_dev(div5, strong2);
    			append_dev(div5, t28);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div5, null);
    			}

    			append_dev(div5, t29);
    			append_dev(div5, div4);
    			append_dev(div4, label2);
    			append_dev(div4, t31);
    			append_dev(div4, input2);
    			set_input_value(input2, /*inputs*/ ctx[0].otherExcludedKeywords);
    			append_dev(form, t32);
    			append_dev(form, div6);
    			append_dev(div6, input3);
    			input3.checked = /*checkboxes*/ ctx[1].nearMe;
    			append_dev(div6, t33);
    			append_dev(div6, label3);
    			append_dev(form, t35);
    			append_dev(form, div7);
    			append_dev(div7, input4);
    			input4.checked = /*checkboxes*/ ctx[1].verifiedOnly;
    			append_dev(div7, t36);
    			append_dev(div7, label4);
    			append_dev(label4, t37);
    			append_dev(label4, br4);
    			append_dev(label4, t38);
    			append_dev(label4, strong3);
    			append_dev(label4, t40);
    			append_dev(label4, br5);
    			append_dev(label4, t41);
    			append_dev(form, t42);
    			append_dev(form, div8);
    			append_dev(div8, input5);
    			input5.checked = /*checkboxes*/ ctx[1].excludeUnverified;
    			append_dev(div8, t43);
    			append_dev(div8, label5);
    			append_dev(label5, t44);
    			append_dev(label5, br6);
    			append_dev(label5, t45);
    			append_dev(form, t46);
    			append_dev(form, div9);
    			append_dev(div9, button);
    			append_dev(div10, t48);
    			if (if_block) if_block.m(div10, null);
    			append_dev(div15, t49);
    			append_dev(div15, div11);
    			append_dev(div11, h22);
    			append_dev(div11, t51);
    			append_dev(div11, ol1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol1, null);
    			}

    			append_dev(div11, t52);
    			append_dev(div11, h3);
    			append_dev(div15, t54);
    			append_dev(div15, div12);
    			append_dev(div12, h23);
    			append_dev(div12, t56);
    			append_dev(div12, ul0);
    			append_dev(ul0, li3);
    			append_dev(li3, a0);
    			append_dev(a0, t57);
    			append_dev(a0, br7);
    			append_dev(a0, br8);
    			append_dev(a0, t58);
    			append_dev(div12, t59);
    			append_dev(div12, ul1);
    			append_dev(ul1, li4);
    			append_dev(li4, a1);
    			append_dev(div15, t61);
    			append_dev(div15, div13);
    			append_dev(div13, h24);
    			append_dev(div13, t63);
    			append_dev(div13, ul2);
    			append_dev(ul2, li5);
    			append_dev(li5, a2);
    			append_dev(ul2, t65);
    			append_dev(ul2, br9);
    			append_dev(ul2, br10);
    			append_dev(ul2, t66);
    			append_dev(ul2, br11);
    			append_dev(ul2, t67);
    			append_dev(div15, t68);
    			append_dev(div15, div14);
    			append_dev(div14, h25);
    			append_dev(div14, t70);
    			append_dev(div14, ul3);
    			append_dev(ul3, li6);
    			append_dev(li6, a3);
    			append_dev(li6, t72);
    			append_dev(main, t73);
    			append_dev(main, div19);
    			append_dev(div19, div16);
    			append_dev(div16, a4);
    			append_dev(div19, t75);
    			append_dev(div19, div17);
    			append_dev(div17, t76);
    			append_dev(div17, a5);
    			append_dev(div17, t78);
    			append_dev(div19, t79);
    			append_dev(div19, div18);
    			append_dev(div18, t80);
    			append_dev(div18, a6);

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
    				each_blocks_2 = update_keyed_each(each_blocks_2, dirty, get_key, 1, ctx, each_value_3, each0_lookup, div3, destroy_block, create_each_block_3, t22, get_each_context_3);
    			}

    			if (dirty & /*inputs*/ 1 && input1.value !== /*inputs*/ ctx[0].otherAlsoSearchFor) {
    				set_input_value(input1, /*inputs*/ ctx[0].otherAlsoSearchFor);
    			}

    			if (dirty & /*Object, excludeKeywords*/ 8) {
    				each_value_2 = Object.keys(/*excludeKeywords*/ ctx[3]);
    				validate_each_argument(each_value_2);
    				validate_each_keys(ctx, each_value_2, get_each_context_2, get_key_1);
    				each_blocks_1 = update_keyed_each(each_blocks_1, dirty, get_key_1, 1, ctx, each_value_2, each1_lookup, div5, destroy_block, create_each_block_2, t29, get_each_context_2);
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
    			if (detaching) detach_dev(meta);
    			if (detaching) detach_dev(t0);
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

<?php
namespace WevyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Repeater;

if (!defined('ABSPATH')) exit;

class Pricing_Card extends Widget_Base {
    public function get_name() { return 'wf-pricing-card'; }
    public function get_title() { return 'WevyFlow Pricing Card'; }
    public function get_icon() { return 'eicon-price-table'; }
    public function get_categories() { return ['wevyflow']; }

    protected function register_controls() {
        $this->start_controls_section('header_section', ['label' => 'Cabecalho']);
        $this->add_control('heading', ['label' => 'Titulo da secao', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Tudo isso por um unico investimento']);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();

        $this->start_controls_section('card_section', ['label' => 'Card de Preco']);
        $this->add_control('badge', ['label' => 'Badge', 'type' => Controls_Manager::TEXT, 'default' => 'Oferta especial']);
        $this->add_control('card_title', ['label' => 'Titulo do card', 'type' => Controls_Manager::TEXT, 'default' => 'Acesso completo ao Metodo RMX + todos os bonus']);

        $repeater = new Repeater();
        $repeater->add_control('text', ['label' => 'Item', 'type' => Controls_Manager::TEXT]);
        $repeater->add_control('value', ['label' => 'Valor original', 'type' => Controls_Manager::TEXT]);
        $this->add_control('items', [
            'label' => 'Itens inclusos',
            'type' => Controls_Manager::REPEATER,
            'fields' => $repeater->get_controls(),
            'default' => [
                ['text' => 'Metodo RMX Completo — 8 modulos', 'value' => 'R$ 1.497'],
                ['text' => 'Comunidade VIP — acesso vitalicio', 'value' => 'R$ 297'],
                ['text' => 'Templates de Conteudo', 'value' => 'R$ 197'],
                ['text' => 'Mentoria em Grupo — 12 meses', 'value' => 'R$ 497'],
            ],
            'title_field' => '{{{ text }}}',
        ]);

        $this->add_control('original_price', ['label' => 'Preco original', 'type' => Controls_Manager::TEXT, 'default' => 'R$ 2.488,00']);
        $this->add_control('price', ['label' => 'Preco final', 'type' => Controls_Manager::TEXT, 'default' => 'R$ 497']);
        $this->add_control('installments', ['label' => 'Parcelamento', 'type' => Controls_Manager::TEXT, 'default' => '12x de R$ 49,42']);
        $this->add_control('cta_text', ['label' => 'Texto do CTA', 'type' => Controls_Manager::TEXT, 'default' => 'Garantir minha vaga agora']);
        $this->add_control('cta_url', ['label' => 'Link do CTA', 'type' => Controls_Manager::URL, 'default' => ['url' => '#']]);
        $this->end_controls_section();

        $this->start_controls_section('seals_section', ['label' => 'Selos']);
        $this->add_control('seal_1', ['label' => 'Selo 1', 'type' => Controls_Manager::TEXT, 'default' => 'Pagamento seguro']);
        $this->add_control('seal_2', ['label' => 'Selo 2', 'type' => Controls_Manager::TEXT, 'default' => 'Garantia 7 dias']);
        $this->add_control('seal_3', ['label' => 'Selo 3', 'type' => Controls_Manager::TEXT, 'default' => 'Acesso imediato']);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        $cta_url = $s['cta_url'] ?? [];
        $url = is_array($cta_url) ? ($cta_url['url'] ?? '#') : '#';
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-price-section">
                <div class="wf-wrap">
                    <div class="wf-shead wf-rv">
                        <div class="wf-label">Investimento</div>
                        <h2 class="wf-h2"><?php echo esc_html($s['heading']); ?></h2>
                    </div>
                    <div class="wf-price-layout wf-rv">
                        <div class="wf-price-card">
                            <div class="wf-price-corner"></div>
                            <div class="wf-price-badge"><?php echo esc_html($s['badge']); ?></div>
                            <h3 class="wf-price-title"><?php echo esc_html($s['card_title']); ?></h3>
                            <ul class="wf-price-list">
                                <?php foreach ($s['items'] as $i => $item): ?>
                                <li>
                                    <span class="wf-price-num"><?php echo sprintf('%02d', $i + 1); ?></span>
                                    <span class="wf-price-text"><strong><?php echo esc_html($item['text']); ?></strong></span>
                                    <span class="wf-price-old"><?php echo esc_html($item['value']); ?></span>
                                </li>
                                <?php endforeach; ?>
                            </ul>
                            <p class="wf-price-from">De <span class="wf-strike"><?php echo esc_html($s['original_price']); ?></span> por apenas:</p>
                            <p class="wf-price-main"><?php echo esc_html($s['price']); ?></p>
                            <p class="wf-price-alt">ou <strong><?php echo esc_html($s['installments']); ?></strong> no cartao</p>
                            <a href="<?php echo esc_url($url); ?>" class="wf-btn wf-btn--solid wf-price-cta">
                                <?php echo esc_html($s['cta_text']); ?>
                                <span class="wf-arrow">&rarr;</span>
                            </a>
                            <div class="wf-seals">
                                <div class="wf-seal">
                                    <div class="wf-seal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                                    <span class="wf-seal-label"><?php echo esc_html($s['seal_1']); ?></span>
                                </div>
                                <div class="wf-seal">
                                    <div class="wf-seal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg></div>
                                    <span class="wf-seal-label"><?php echo esc_html($s['seal_2']); ?></span>
                                </div>
                                <div class="wf-seal">
                                    <div class="wf-seal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                                    <span class="wf-seal-label"><?php echo esc_html($s['seal_3']); ?></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}

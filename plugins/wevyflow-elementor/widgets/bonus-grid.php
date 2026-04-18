<?php
namespace WevyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Repeater;

if (!defined('ABSPATH')) exit;

class Bonus_Grid extends Widget_Base {
    public function get_name() { return 'wf-bonus-grid'; }
    public function get_title() { return 'WevyFlow Bonus Grid'; }
    public function get_icon() { return 'eicon-gift'; }
    public function get_categories() { return ['wevyflow']; }

    protected function register_controls() {
        $this->start_controls_section('header_section', ['label' => 'Cabecalho']);
        $this->add_control('number', ['label' => 'Numero', 'type' => Controls_Manager::TEXT, 'default' => '04']);
        $this->add_control('label', ['label' => 'Label', 'type' => Controls_Manager::TEXT, 'default' => 'Bonus exclusivos']);
        $this->add_control('heading', ['label' => 'Titulo', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Bonus que aceleram seus resultados']);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();

        $this->start_controls_section('bonus_section', ['label' => 'Bonus']);
        $repeater = new Repeater();
        $repeater->add_control('title', ['label' => 'Titulo', 'type' => Controls_Manager::TEXT, 'default' => 'Bonus']);
        $repeater->add_control('description', ['label' => 'Descricao', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Descricao do bonus.']);
        $repeater->add_control('value', ['label' => 'Valor original', 'type' => Controls_Manager::TEXT, 'default' => 'R$ 297']);
        $this->add_control('bonuses', [
            'label' => 'Bonus',
            'type' => Controls_Manager::REPEATER,
            'fields' => $repeater->get_controls(),
            'default' => [
                ['title' => 'Comunidade VIP', 'description' => 'Acesso a comunidade exclusiva com networking, duvidas e desafios semanais.', 'value' => 'R$ 297'],
                ['title' => 'Templates de Conteudo', 'description' => 'Modelos prontos para transformar qualquer leitura em posts de alto engajamento.', 'value' => 'R$ 197'],
                ['title' => 'Mentoria em Grupo', 'description' => 'Sessoes ao vivo mensais para tirar duvidas e acelerar sua jornada.', 'value' => 'R$ 497'],
            ],
            'title_field' => '{{{ title }}}',
        ]);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-content">
                <div class="wf-wrap">
                    <div class="wf-shead wf-rv">
                        <div class="wf-label"><span class="wf-num"><?php echo esc_html($s['number']); ?></span> <?php echo esc_html($s['label']); ?></div>
                        <h2 class="wf-h2"><?php echo esc_html($s['heading']); ?></h2>
                    </div>
                    <div class="wf-bonus-grid wf-rv">
                        <?php foreach ($s['bonuses'] as $i => $bonus): ?>
                        <div class="wf-bonus-card">
                            <div class="wf-bonus-head">
                                <span class="wf-bonus-num">Bonus <?php echo sprintf('%02d', $i + 1); ?></span>
                                <span class="wf-bonus-value"><?php echo esc_html($bonus['value']); ?></span>
                            </div>
                            <h3><?php echo esc_html($bonus['title']); ?></h3>
                            <p><?php echo esc_html($bonus['description']); ?></p>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
